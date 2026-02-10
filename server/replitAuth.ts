import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";
import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

const isDevelopment =
  process.env.NODE_ENV === "development" || process.env.FORCE_LOCAL_AUTH === "true";

const replitDomains = process.env.REPLIT_DOMAINS?.split(",") || [];

/* -------------------------------------------------------------------------- */
/* ✅ LOCAL AUTH (email/password login for local development)                 */
/* -------------------------------------------------------------------------- */
function setupLocalAuth(app: Express) {
  console.log("🔒 Using local email/password authentication (Replit Auth disabled)");

  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  // ✅ Only define session middleware ONCE (here)
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "local-secret",
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: false, // true if HTTP  S
        sameSite: "lax",
        maxAge: sessionTtl,
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  // Map session user into req.user so route handlers that expect
  // `req.user.claims.sub` work in local development mode.
  app.use((req, _res, next) => {
    const sUser = (req.session as any)?.user;
    if (sUser) {
      // normalize to the shape used by production (`req.user.claims.sub`)
      req.user = req.user || {};
      (req.user as any).claims = (req.user as any).claims || {};
      // Use explicit id if provided, else fallback to email
      (req.user as any).claims.sub = sUser.id || sUser.email || sUser.claims?.sub;
      (req.user as any).claims.email = sUser.email || sUser.claims?.email;
      // expiry for consistency with replit session shape
      (req.user as any).expires_at = Math.floor(Date.now() / 1000) + Math.floor(sessionTtl / 1000);
    }
    next();
  });

  const LOCAL_USER = {
    id: "local-user-id",
    email: "admin@example.com",
    password: "admin123",
    firstName: "Local",
    lastName: "Admin",
  };

  // ---- Local login routes ----
  app.post("/api/login", async (req, res) => {
    const { email, password, role } = req.body;

    // Basic local-only check: allow the built-in LOCAL_USER
    if (email === LOCAL_USER.email && password === LOCAL_USER.password) {
      (req.session as any).user = {
        id: LOCAL_USER.id,
        email: LOCAL_USER.email,
        firstName: LOCAL_USER.firstName,
        lastName: LOCAL_USER.lastName,
        role: role || 'Admin',
      };
      console.log(`✅ Logged in as ${email}`);
      // Ensure DB has this user for subsequent lookups
      try {
        await storage.upsertUser({
          id: LOCAL_USER.id,
          email: LOCAL_USER.email,
          firstName: LOCAL_USER.firstName,
          lastName: LOCAL_USER.lastName,
          profileImageUrl: "",
          role: role || 'Admin',
        });
      } catch (err) {
        console.warn('Could not upsert local user into DB', err);
      }
      return res.json({ success: true, message: "Login successful", user: (req.session as any).user });
    }

    // For developer convenience: allow logging in with the client-side mock users
    // The client sends { email, password, role } from `client/src/config/users.json`.
    // We don't validate the password server-side here (dev only). Create/upsert the
    // user in storage and create a session so API calls have an authenticated session.
    if (email && password && role) {
      const userId = email; // use email as stable id in DEV
      const firstName = (email.split('@')[0] || 'Dev').replace(/[^a-zA-Z]/g, '');
      (req.session as any).user = {
        id: userId,
        email,
        firstName,
        lastName: '',
        role,
      };

      try {
        await storage.upsertUser({
          id: userId,
          email,
          firstName,
          lastName: '',
          profileImageUrl: '',
          role,
        });
      } catch (err) {
        console.warn('Could not upsert dev user into DB', err);
      }

      console.log(`✅ DEV login created for ${email} as ${role}`);
      return res.json({ success: true, message: "Login successful (DEV)", user: (req.session as any).user });
    }

    return res.status(401).json({ success: false, message: "Invalid credentials" });
  });

  app.get("/api/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true, message: "Logged out" });
    });
  });

  app.get("/api/me", (req, res) => {
    if ((req.session as any).user) {
      return res.json((req.session as any).user);
    }
    res.status(401).json({ message: "Not authenticated" });
  });

  console.log("✅ Local auth endpoints ready: /api/login /api/logout /api/me");
}

// ✅ unified middleware to check login state
const localIsAuthenticated: RequestHandler = (req, res, next) => {
  if ((req.session as any).user) return next();
  return res.status(401).json({ message: "Unauthorized" });
};

/* -------------------------------------------------------------------------- */
/* 🟢 REAL REPLIT AUTH (for production on Replit)                             */
/* -------------------------------------------------------------------------- */
const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

const registeredStrategies = new Set<string>();

async function ensureStrategyForDomain(domain: string) {
  const strategyName = `replitauth:${domain}`;
  if (registeredStrategies.has(strategyName)) return strategyName;

  const config = await getOidcConfig();
  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  const strategy = new Strategy(
    {
      name: strategyName,
      config,
      scope: "openid email profile offline_access",
      callbackURL: `https://${domain}/api/callback`,
    },
    verify
  );

  passport.use(strategy);
  registeredStrategies.add(strategyName);
  return strategyName;
}

async function setupReplitAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  if (replitDomains.length > 0) {
    console.log(`[Auth] Registering strategies for domains: ${replitDomains.join(", ")}`);
    for (const domain of replitDomains) {
      await ensureStrategyForDomain(domain);
    }
  } else {
    console.log("[Auth] REPLIT_DOMAINS not available (production mode)");
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", async (req, res, next) => {
    try {
      const strategyName = await ensureStrategyForDomain(req.hostname);
      passport.authenticate(strategyName, {
        prompt: "login consent",
        scope: ["openid", "email", "profile", "offline_access"],
      })(req, res, next);
    } catch (error) {
      console.error("[Auth] Login error:", error);
      res.status(500).json({ message: "Authentication setup failed" });
    }
  });

  app.get("/api/callback", async (req, res, next) => {
    try {
      const strategyName = await ensureStrategyForDomain(req.hostname);
      passport.authenticate(strategyName, {
        successReturnToOrRedirect: "/",
        failureRedirect: "/api/login",
      })(req, res, next);
    } catch (error) {
      console.error("[Auth] Callback error:", error);
      res.redirect("/api/login");
    }
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

const replitIsAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;
  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) return next();

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch {
    res.status(401).json({ message: "Unauthorized" });
  }
};

/* -------------------------------------------------------------------------- */
/* 🧠 EXPORT CORRECT IMPLEMENTATION BASED ON ENVIRONMENT                      */
/* -------------------------------------------------------------------------- */
export const setupAuth = isDevelopment ? setupLocalAuth : setupReplitAuth;
export const isAuthenticated = isDevelopment
  ? localIsAuthenticated
  : replitIsAuthenticated;
