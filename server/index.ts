import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import fs from "fs";
import multer from "multer";
import cookieParser from "cookie-parser";
import session from "express-session";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, log } from "./vite";
import { setupAuth } from "./replitAuth";

const app = express();

/* ------------------------ 🍪 Enable cookies ------------------------ */
app.use(cookieParser());

/* ------------------------ 💾 Session middleware ------------------------ */
app.use(
  session({
    secret: process.env.SESSION_SECRET || "rotarycrm_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax", // ✅ works fine for single-domain setup
      secure: false, // ⚠️ set true only when using https
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

/* ------------------------ 🌐 CORS setup ------------------------ */
/**
 * For local + LAN usage it's easiest to let CORS echo back the Origin
 * and allow credentials. This works whether you open the app on:
 *
 *   - http://localhost:5000
 *   - http://127.0.0.1:5000
 *   - http://192.168.x.x:5000 (your LAN IP)
 */
app.use(
  cors({
    origin: true, // ✅ reflect request origin (localhost or LAN IP)
    credentials: true, // ✅ allows cookies/sessions
  })
);

/* ------------------------ 📦 Body parsers ------------------------ */
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));
app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "uploads"))
);

/* ------------------------ 🧠 API logging ------------------------ */
app.use((req, res, next) => {
  const start = Date.now();
  const pathName = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    // @ts-expect-error – spread to original
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (pathName.startsWith("/api")) {
      let logLine = `${req.method} ${pathName} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 120) logLine = logLine.slice(0, 119) + "…";
      log(logLine);
    }
  });

  next();
});

/* ------------------------ 🚀 Start app ------------------------ */
(async () => {
  await setupAuth(app); // ✅ keep your existing auth setup

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    console.error("❌ Server error:", err);
  });

  /* ------------------------ 🌐 Frontend serving ------------------------ */
  const nodeEnv = process.env.NODE_ENV || "development";
  const isDev = nodeEnv === "development";
  log(`NODE_ENV at startup: ${nodeEnv} (isDev=${isDev})`);

  if (isDev) {
    // Dev mode: use Vite dev server
    await setupVite(app, server);
  } else {
    // Production / self-hosted mode: serve built React app from dist/public
    const rootDir = path.resolve(); // e.g. C:\CRM Live\SangliCRM_Live
    const publicDir = path.join(rootDir, "dist", "public");

    log(`Serving static frontend from: ${publicDir}`);

    app.use(express.static(publicDir));

    app.get("*", (_req, res) => {
      res.sendFile(path.join(publicDir, "index.html"));
    });
  }

  const PORT = parseInt(process.env.PORT || "5000", 10);

  // 🔴 OLD:
  // const HOST = process.env.HOST || "127.0.0.1";
  // ✅ NEW: listen on all interfaces so other devices can reach it
  const HOST = process.env.HOST || "0.0.0.0";

  server.listen(PORT, HOST, () => {
    log(`✅ Server running at http://${HOST}:${PORT}`);
    log("   - On this PC:     http://localhost:" + PORT);
    log("   - On your LAN:    http://<your-LAN-IP>:" + PORT);
  });
})();
