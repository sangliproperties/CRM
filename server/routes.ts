import mime from "mime-types";
import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { ZodError } from "zod";
import multer from "multer";

import { setupAuth, isAuthenticated } from "./replitAuth";
import { z } from "zod";
import {
  insertLeadSchema,
  insertPropertySchema,
  insertOwnerSchema,
  insertApartmentSchema,
  insertClientSchema,
  insertActivitySchema,
  insertContactSubmissionSchema,
  insertProjectSchema,
  insertDocumentAttachmentSchema,
  insertSellAgreementSchema,
  insertProjectOwnerSchema,
  insertRentAgreementSchema,
  insertProjectTowerSchema,
  insertProjectUnitConfigSchema,
  insertProjectImageSchema,
  insertProjectDocumentSchema,
} from "@shared/schema";
import { ObjectStorageService } from "./objectStorage";
import { PDFGenerator } from "./pdfGenerator";
import { appendActivityTxtLog } from "./utils/activityTxtLogger";
import nodemailer from "nodemailer";


const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 465),
  secure: (process.env.SMTP_SECURE || "true") === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const uploadsDir = path.resolve(process.cwd(), "local_uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "");
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
});

async function sendOwnerRegistrationEmail(to: string, ownerName?: string | null) {
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  const subject = "सांगली प्रॉपर्टीज एल. एल. पी. कडे प्रॉपर्टी नोंदणीची पुष्टी";

  const ownerLine = ownerName
    ? `आदरणीय ${ownerName} महोदय/महोदया ,`
    : "आदरणीय महोदय/महोदया ,";

  const text = `${ownerLine}

सांगली प्रॉपर्टीज एल. एल. पी. कडून नमस्कार ,

आपल्याला कळविण्यात आनंद होत आहे की आपल्या प्रॉपर्टीची माहिती यशस्वीरित्या सांगली प्रॉपर्टीज एल. एल. पी.  कडे नोंदणीकृत करण्यात आली आहे. आपली प्रॉपर्टी आता आमच्या अधिकृत नोंदींमध्ये समाविष्ट असून, आपल्या गरजेनुसार ती संभाव्य खरेदीदार/भाडेकरूंना सादर केली जाईल.

आमच्याकडे प्रॉपर्टी नोंदणी करून, आपण आमच्या अटी व शर्ती तसेच लागू असलेल्या कमिशन साठी मान्य असून ते समजून घेऊन त्यास संमती दिली आहे, याची आपण खात्री देता, असे समजण्यात येईल.

योग्य चौकशी प्राप्त झाल्यास आमची टीम आपल्याशी संपर्क साधेल. दरम्यान, आपल्याला कोणतीही माहिती अद्ययावत करायची असल्यास किंवा काही प्रश्न असल्यास कृपया आमच्याशी निःसंकोच संपर्क साधावा.

सांगली प्रॉपर्टीज एल. एल. पी. वर विश्वास ठेवल्याबद्दल धन्यवाद. आपला मालमत्ता व्यवहार सुरळीत व यशस्वी करण्यासाठी आम्ही सदैव तत्पर आहोत.

आपला नम्र,
सांगली प्रॉपर्टीज एल. एल. पी.
रिअल इस्टेट व प्रॉपर्टी सल्लागार
संपर्क : 9156037011
ई-मेल : rajeshtunge@gmail.com`;

  await transporter.sendMail({ from, to, subject, text });
}

// Facebook/Instagram integration - commented out for future use
// import { verifyFacebookWebhook, processFacebookWebhook } from "./facebookWebhook";
const isAdminLike = (role?: string | null) =>
  role === "Admin" || role === "SuperAdmin" || role === "Super Admin";
const isAdmin = async (req: any, res: any, next: any) => {
  try {
    const user = req.user;
    if (!user?.claims?.sub) return res.status(401).json({ message: "Not authenticated" });

    const dbUser = await storage.getUser(user.claims.sub);
    if (!dbUser || !isAdminLike(dbUser.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    next();
  } catch {
    return res.status(500).json({ message: "Authorization error" });
  }
};


function getClientIp(req: any) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  return req.ip || req.connection?.remoteAddress || "";
}

function inferEntity(pathname: string) {
  // Very simple mapping. You can expand anytime.
  // Examples:
  // /api/leads/123 -> { entityType:"lead", entityId:"123" }
  const parts = pathname.split("?")[0].split("/").filter(Boolean); // ["api","leads","123"]
  if (parts.length >= 3) {
    const entityType = parts[1]; // leads, properties...
    const entityId = parts[2];
    return { entityType: entityType.replace(/s$/, ""), entityId };
  }
  return { entityType: undefined, entityId: undefined };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // ✅ Server-wide activity logger for all authenticated users
  app.use("/api", (req, res, next) => {
    const startTime = Date.now();

    res.on("finish", async () => {
      try {
        // Only log successful requests
        if (res.statusCode >= 400) return;

        // Avoid logging the logs page itself to prevent noise/loops
        if (req.path.startsWith("/activity-logs")) return;

        // Log all important requests (you can change this rule anytime)
        const method = (req.method || "GET").toUpperCase();
        const shouldLog =
          method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE" || method === "GET";

        if (!shouldLog) return;

        // If user is not logged in, skip (only capture real user activity)
        const sessionUser = (req.session as any)?.user;
        const user = sessionUser || (req as any).user;
        if (!user?.id) return;

        const { entityType, entityId } = inferEntity(req.originalUrl || req.path);

        // Simple action naming
        const action = `${method}_${(req.path || "").replace(/\//g, "_").replace(/^_/, "")}`.slice(0, 80);

        await storage.createActivityLog({
          userRole: user?.role,
          userId: user?.id,
          action,
          method,
          path: req.originalUrl || req.path,
          entityType,
          entityId,
          ip: getClientIp(req),
          userAgent: req.headers["user-agent"] || "",
        });

        // ✅ Also write day-wise user-wise TXT log
        const firstName = String(user?.firstName || "").trim();
        const lastName = String(user?.lastName || "").trim();
        const email = String(user?.email || "").trim();

        // Prefer full name, fallback to email, fallback to user id
        const userName =
          (firstName || lastName)
            ? `${firstName} ${lastName}`.trim()
            : (email || String(user?.id || "Unknown"));

        appendActivityTxtLog({
          time: new Date(),
          userRole: String(user?.role || ""),
          userName,
          method,
          path: req.originalUrl || req.path,
          ip: getClientIp(req),
        });
      } catch (e) {
        // Never break app because of logging
        console.error("Activity log error:", e);
      }
    });

    next();
  });


  // Auth routes
  // DEV-only debug route to inspect session/user (helps troubleshoot 401s)
  if (process.env.NODE_ENV === "development") {
    app.get("/api/debug-session", async (req: any, res) => {
      try {
        return res.json({
          session: (req.session as any) || null,
          user: req.user || null,
        });
      } catch (err) {
        return res.status(500).json({ message: "Failed to read session" });
      }
    });
  }

  // ✅ Basic Email Login (creates session + req.user.claims.sub)
  app.post("/api/login", async (req: any, res) => {
    try {
      const loginId = String(req.body?.email || req.body?.username || "").trim();
      if (!loginId) return res.status(400).json({ message: "Email is required" });

      // Find user by email from DB
      const allUsers = await storage.getAllUsers();
      const dbUser = allUsers.find(
        (u) => (u.email || "").toLowerCase() === loginId.toLowerCase()
      );

      if (!dbUser) return res.status(401).json({ message: "Invalid user" });

      // ✅ Save session user
      (req.session as any).user = {
        id: dbUser.id,
        role: dbUser.role,
        email: dbUser.email,
        firstName: (dbUser as any).firstName,
        lastName: (dbUser as any).lastName,
      };

      // ✅ Normalize req.user.claims.sub so your existing routes work
      (req as any).user = (req as any).user || {};
      (req as any).user.claims = (req as any).user.claims || {};
      (req as any).user.claims.sub = String(dbUser.id);

      return res.json({ ok: true, user: dbUser });
    } catch (e) {
      console.error("Login error:", e);
      return res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/logout", (req: any, res) => {
    try {
      req.session?.destroy?.(() => { });
      res.clearCookie("connect.sid");
      return res.json({ ok: true });
    } catch (e) {
      return res.status(200).json({ ok: true });
    }
  });

  app.get("/api/session", (req: any, res) => {
    const u = (req.session as any)?.user;
    if (!u?.id) return res.status(401).json({ message: "Unauthorized" });
    return res.json({ ok: true, user: u });
  });


  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User routes - Get all assignable users (Sales Agents and Marketing Executives)
  app.get("/api/users/agents", isAuthenticated, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const assignableUsers = allUsers.filter(
        (u) =>
          (u.role === "Sales Agent" || u.role === "Marketing Executive") &&
          u.isActive === 1
      );
      res.json(assignableUsers);
    } catch (error) {
      console.error("Error fetching agents:", error);
      res.status(500).json({ message: "Failed to fetch agents" });
    }
  });

  // User Management (Admin only)
  app.get("/api/users", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdminLike(user.role)) {
        return res.status(403).json({ message: "Forbidden - Admin access required" });
      }
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });



  app.post("/api/users", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdminLike(user.role)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { email, role } = req.body;

      if (!email || !role) {
        return res.status(400).json({ message: "Email and role are required" });
      }

      const validRoles = [
        "Admin",
        "SuperAdmin",
        "Super Admin",
        "Sales Agent",
        "Marketing Executive",
        "Property Manager",
      ];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      // Check if user already exists
      const existingUsers = await storage.getAllUsers();
      if (existingUsers.find((u) => u.email === email)) {
        return res
          .status(400)
          .json({ message: "User with this email already exists" });
      }

      const newUser = await storage.createManualUser(email, role);
      res.json(newUser);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id/role", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !isAdminLike(user.role)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { role } = req.body;
      const validRoles = [
        "Admin",
        "SuperAdmin",
        "Super Admin",
        "Sales Agent",
        "Marketing Executive",
        "Property Manager",
      ];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      const updatedUser = await storage.updateUserRole(req.params.id, role);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  app.patch(
    "/api/users/:id/deactivate",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.user.claims.sub);
        if (!user || !isAdminLike(user.role)) {
          return res.status(403).json({ message: "Admin access required" });
        }

        // Prevent deactivating self
        if (req.params.id === req.user.claims.sub) {
          return res
            .status(400)
            .json({ message: "Cannot deactivate your own account" });
        }

        const updatedUser = await storage.deactivateUser(req.params.id);
        res.json(updatedUser);
      } catch (error) {
        console.error("Error deactivating user:", error);
        res.status(500).json({ message: "Failed to deactivate user" });
      }
    }
  );

  app.patch(
    "/api/users/:id/reactivate",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.user.claims.sub);
        if (!user || !isAdminLike(user.role)) {
          return res.status(403).json({ message: "Admin access required" });
        }

        const updatedUser = await storage.reactivateUser(req.params.id);
        res.json(updatedUser);
      } catch (error) {
        console.error("Error reactivating user:", error);
        res.status(500).json({ message: "Failed to reactivate user" });
      }
    }
  );

  // Lead routes
  app.get("/api/leads", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Property Manager role should not have access to leads
      if (user.role === "Property Manager") {
        return res.status(403).json({ message: "Access denied" });
      }

      const allLeads = await storage.getLeads();

      // Sales Agents and Marketing Executives only see leads assigned to them
      if (user.role === "Sales Agent" || user.role === "Marketing Executive") {
        const filteredLeads = allLeads.filter(
          (lead) => lead.assignedTo === userId
        );
        return res.json(filteredLeads);
      }

      // Only Admin sees all leads
      res.json(allLeads);
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  app.get("/api/leads/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Property Manager role should not have access to leads
      if (user.role === "Property Manager") {
        return res.status(403).json({ message: "Access denied" });
      }

      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }

      // Sales Agents and Marketing Executives can only access leads assigned to them
      if (
        (user.role === "Sales Agent" || user.role === "Marketing Executive") &&
        lead.assignedTo !== userId
      ) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(lead);
    } catch (error) {
      console.error("Error fetching lead:", error);
      res.status(500).json({ message: "Failed to fetch lead" });
    }
  });

  app.post("/api/leads", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      if (user.role === "Property Manager") {
        return res.status(403).json({ message: "Access denied" });
      }

      // 🛠 Fix: Normalize incoming body fields before validation
      const body: any = { ...req.body };

      // budget: keep as string; only drop if empty/null/undefined
      if (body.budget === "" || body.budget === null || typeof body.budget === "undefined") {
        delete body.budget;
      }

      // nextFollowUp: still convert to Date
      if (body.nextFollowUp === "" || body.nextFollowUp === null || typeof body.nextFollowUp === "undefined") {
        delete body.nextFollowUp;
      } else {
        body.nextFollowUp = new Date(body.nextFollowUp);
      }

      // 🧩 Validate against schema after normalization
      const validated = insertLeadSchema.parse(body);


      // Validate assigned user existence
      if (validated.assignedTo) {
        const assignedUser = await storage.getUser(validated.assignedTo);
        if (!assignedUser) {
          return res.status(400).json({
            message: "Assigned user does not exist. Please refresh and try again.",
          });
        }
      }

      const lead = await storage.createLead(validated);
      res.status(201).json(lead);
    } catch (error) {
      console.error("❌ Error creating lead:", error);

      if (error instanceof Error && "issues" in error) {
        console.error("Zod validation issues:", (error as any).issues);
      }

      res.status(400).json({ message: "Failed to create lead" });
    }
  });

  app.patch("/api/leads/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Property Manager role should not have access to leads
      if (user.role === "Property Manager") {
        return res.status(403).json({ message: "Access denied" });
      }

      const existingLead = await storage.getLead(req.params.id);
      if (!existingLead) {
        return res.status(404).json({ message: "Lead not found" });
      }

      // Sales Agents and Marketing Executives can only update leads assigned to them
      if (
        (user.role === "Sales Agent" || user.role === "Marketing Executive") &&
        existingLead.assignedTo !== userId
      ) {
        return res.status(403).json({ message: "Access denied" });
      }

      console.log(
        "🔍 PATCH /api/leads/%s - incoming body:",
        req.params.id,
        req.body
      );
      // Normalize incoming fields similar to POST handler
      const normalizedBody: any = {
        ...req.body,
        budget:
          req.body &&
            req.body.budget !== undefined &&
            req.body.budget !== null &&
            req.body.budget !== ""
            ? req.body.budget // ⬅️ keep as string
            : undefined,
        nextFollowUp: req.body && req.body.nextFollowUp
          ? new Date(req.body.nextFollowUp)
          : undefined,
        // ✅ Let Zod's preprocess handle string → Date for leadCreationDate
        leadCreationDate: req.body && req.body.leadCreationDate
          ? req.body.leadCreationDate
          : undefined,
      };


      // If client sent an email for assignedTo, try to resolve it to a user id BEFORE validation
      if (
        normalizedBody.assignedTo &&
        typeof normalizedBody.assignedTo === "string" &&
        normalizedBody.assignedTo.includes("@")
      ) {
        const allUsers = await storage.getAllUsers();
        const matched = allUsers.find(
          (u) =>
            u.email &&
            u.email.toLowerCase() ===
            (normalizedBody.assignedTo as string).toLowerCase()
        );
        if (matched) {
          normalizedBody.assignedTo = matched.id;
        } else {
          console.error(
            "Assigned user email not found (pre-parse):",
            normalizedBody.assignedTo
          );
          return res.status(400).json({
            message:
              "Assigned user does not exist. Please refresh the page and try again.",
          });
        }
      }

      let validated;
      try {
        validated = insertLeadSchema.partial().parse(normalizedBody);
      } catch (zErr) {
        console.error("❌ Zod validation error while updating lead:", zErr);
        if (zErr && typeof zErr === "object" && "issues" in (zErr as any)) {
          console.error("Zod issues:", (zErr as any).issues);
        }
        return res
          .status(400)
          .json({ message: "Invalid input data for updating lead" });
      }

      // If assignedTo is empty string, treat it as null (clear assignment)
      if (validated.assignedTo === "") {
        // @ts-ignore
        validated.assignedTo = null;
      }

      // If assignedTo looks like an email, try to resolve to a user id
      if (
        validated.assignedTo &&
        typeof validated.assignedTo === "string" &&
        validated.assignedTo.includes("@")
      ) {
        const allUsers = await storage.getAllUsers();
        const matched = allUsers.find(
          (u) =>
            u.email &&
            u.email.toLowerCase() ===
            (validated.assignedTo as string).toLowerCase()
        );
        if (matched) {
          validated.assignedTo = matched.id as any;
        } else {
          console.error(
            "Assigned user email not found:",
            validated.assignedTo
          );
          return res.status(400).json({
            message:
              "Assigned user does not exist. Please refresh the page and try again.",
          });
        }
      }

      if (validated.assignedTo) {
        const assignedUser = await storage.getUser(
          validated.assignedTo as string
        );
        if (!assignedUser) {
          console.error(
            "Assigned user not found for id:",
            validated.assignedTo
          );
          return res.status(400).json({
            message:
              "Assigned user does not exist. Please refresh the page and try again.",
          });
        }
      }

      const lead = await storage.updateLead(req.params.id, validated);
      res.json(lead);
    } catch (error) {
      console.error("Error updating lead:", error);
      res.status(400).json({ message: "Failed to update lead" });
    }
  });

  app.delete("/api/leads/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Property Manager role should not have access to leads
      if (user.role === "Property Manager") {
        return res.status(403).json({ message: "Access denied" });
      }

      const existingLead = await storage.getLead(req.params.id);
      if (!existingLead) {
        return res.status(404).json({ message: "Lead not found" });
      }

      // Sales Agents and Marketing Executives can only delete leads assigned to them
      if (
        (user.role === "Sales Agent" || user.role === "Marketing Executive") &&
        existingLead.assignedTo !== userId
      ) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteLead(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting lead:", error);
      res.status(500).json({ message: "Failed to delete lead" });
    }
  });

  // Activity routes
  app.get("/api/leads/:id/activities", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Property Manager role should not have access to lead activities
      if (user.role === "Property Manager") {
        return res.status(403).json({ message: "Access denied" });
      }

      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }

      // Sales Agents and Marketing Executives can only view activities for leads assigned to them
      if (
        (user.role === "Sales Agent" || user.role === "Marketing Executive") &&
        lead.assignedTo !== userId
      ) {
        return res.status(403).json({ message: "Access denied" });
      }

      const activities = await storage.getActivities(req.params.id);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  app.post("/api/leads/:id/activities", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Property Manager role should not have access to lead activities
      if (user.role === "Property Manager") {
        return res.status(403).json({ message: "Access denied" });
      }

      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }

      // Sales Agents and Marketing Executives can only add activities to leads assigned to them
      if (
        (user.role === "Sales Agent" || user.role === "Marketing Executive") &&
        lead.assignedTo !== userId
      ) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validated = insertActivitySchema.parse({
        ...req.body,
        leadId: req.params.id,
        performedBy: userId,
      });
      const activity = await storage.createActivity(validated);
      res.status(201).json(activity);
    } catch (error) {
      console.error("Error creating activity:", error);
      res.status(400).json({ message: "Failed to create activity" });
    }
  });

  app.patch(
    "/api/activities/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const user = await storage.getUser(userId);

        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }

        if (user.role === "Property Manager") {
          return res.status(403).json({ message: "Access denied" });
        }

        const activity = await storage.getActivity(req.params.id);
        if (!activity) {
          return res.status(404).json({ message: "Activity not found" });
        }

        const lead = await storage.getLead(activity.leadId!);
        if (!lead) {
          return res.status(404).json({ message: "Lead not found" });
        }

        // Sales Agent / Marketing Executive can only edit activities for leads assigned to them
        if (
          (user.role === "Sales Agent" ||
            user.role === "Marketing Executive") &&
          lead.assignedTo !== userId
        ) {
          return res.status(403).json({ message: "Access denied" });
        }

        const updated = await storage.updateActivity(req.params.id, {
          type: req.body.type ?? activity.type,
          description: req.body.description ?? activity.description,
        });

        res.json(updated);
      } catch (error) {
        console.error("Error updating activity:", error);
        res.status(400).json({ message: "Failed to update activity" });
      }
    }
  );

  app.delete(
    "/api/activities/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const user = await storage.getUser(userId);

        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }

        if (user.role === "Property Manager") {
          return res.status(403).json({ message: "Access denied" });
        }

        const activity = await storage.getActivity(req.params.id);
        if (!activity) {
          return res.status(404).json({ message: "Activity not found" });
        }

        const lead = await storage.getLead(activity.leadId!);
        if (!lead) {
          return res.status(404).json({ message: "Lead not found" });
        }

        if (
          (user.role === "Sales Agent" ||
            user.role === "Marketing Executive") &&
          lead.assignedTo !== userId
        ) {
          return res.status(403).json({ message: "Access denied" });
        }

        await storage.deleteActivity(req.params.id);
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting activity:", error);
        res.status(500).json({ message: "Failed to delete activity" });
      }
    }
  );

  app.get("/api/rent-agreements", async (req, res) => {
    try {
      const clientId =
        typeof req.query.clientId === "string" ? req.query.clientId : undefined;

      const ownerId =
        typeof req.query.ownerId === "string" ? req.query.ownerId : undefined;

      const startDate =
        typeof req.query.startDate === "string" ? req.query.startDate : undefined;

      const endDate =
        typeof req.query.endDate === "string" ? req.query.endDate : undefined;

      const rows = await storage.getRentAgreements({
        clientId,
        ownerId,
        startDate,
        endDate,
      });

      res.json(rows);
    } catch (error) {
      console.error("Error fetching rent agreements:", error);
      res.status(500).json({ message: "Failed to fetch rent agreements" });
    }
  });

  app.post("/api/rent-agreements", async (req, res) => {
    try {
      const validated = insertRentAgreementSchema.parse(req.body);
      const row = await storage.createRentAgreement(validated);
      return res.status(201).json(row);
    } catch (error: any) {
      console.error("Error creating rent agreement:", error);

      // ✅ Zod validation error details
      if (error?.issues) {
        return res.status(400).json({
          message: "Validation failed",
          issues: error.issues.map((issue: any) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      return res.status(400).json({
        message: "Failed to create rent agreement",
      });
    }
  });

  app.patch("/api/rent-agreements/:id", async (req, res) => {
    try {
      const id = req.params.id;

      // allow partial update, but still validate field types
      const validated = insertRentAgreementSchema.partial().parse(req.body);

      const row = await storage.updateRentAgreement(id, validated);
      res.json(row);
    } catch (error: any) {
      console.error("Error updating rent agreement:", error);

      if (error?.issues) {
        return res.status(400).json({
          message: "Validation failed",
          issues: error.issues.map((issue: any) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      res.status(400).json({ message: "Failed to update rent agreement" });
    }
  });

  app.delete("/api/rent-agreements/:id", async (req, res) => {
    try {
      const id = req.params.id;
      await storage.deleteRentAgreement(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting rent agreement:", error);
      res.status(400).json({ message: "Failed to delete rent agreement" });
    }
  });

  // Sell Agreements (Admin/SuperAdmin only)
  app.get("/api/sell-agreements", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const rows = await storage.getSellAgreements();
      res.json(rows);
    } catch (error) {
      console.error("Error fetching sell agreements:", error);
      res.status(500).json({ message: "Failed to fetch sell agreements" });
    }
  });

  app.post("/api/sell-agreements", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const validated = insertSellAgreementSchema.parse(req.body);
      const row = await storage.createSellAgreement(validated);
      res.status(201).json(row);
    } catch (error: any) {
      console.error("Error creating sell agreement:", error);
      if (error?.issues) {
        return res.status(400).json({
          message: "Validation failed",
          issues: error.issues.map((i: any) => ({ path: i.path.join("."), message: i.message })),
        });
      }
      res.status(400).json({ message: "Failed to create sell agreement" });
    }
  });

  app.patch("/api/sell-agreements/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = req.params.id;
      const validated = insertSellAgreementSchema.partial().parse(req.body);
      const row = await storage.updateSellAgreement(id, validated);
      res.json(row);
    } catch (error: any) {
      console.error("Error updating sell agreement:", error);
      if (error?.issues) {
        return res.status(400).json({
          message: "Validation failed",
          issues: error.issues.map((i: any) => ({ path: i.path.join("."), message: i.message })),
        });
      }
      res.status(400).json({ message: "Failed to update sell agreement" });
    }
  });

  app.delete("/api/sell-agreements/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = req.params.id;
      await storage.deleteSellAgreement(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting sell agreement:", error);
      res.status(400).json({ message: "Failed to delete sell agreement" });
    }
  });

  // Property routes
  app.get("/api/properties", async (req, res) => {
    try {
      const pageRaw = Number(req.query.page ?? "1");
      const pageSizeRaw = Number(req.query.pageSize ?? "20");

      const safePage = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
      const safeRequestedPageSize =
        Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : 20;

      // 👇 allow up to 5000 rows (used when searching)
      const maxPageSize = 5000;
      const safePageSize = Math.min(safeRequestedPageSize, maxPageSize);

      const offset = (safePage - 1) * safePageSize;

      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const transactionType =
        typeof req.query.transactionType === "string"
          ? req.query.transactionType.trim()
          : undefined;
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const caste = typeof req.query.caste === "string" ? req.query.caste : undefined; // ✅ ADD

      const apartmentId =
        typeof req.query.apartmentId === "string" ? req.query.apartmentId : undefined;

      const { items, total } = await storage.getPropertiesWithTotal({
        limit: safePageSize,
        offset,
        search,
        transactionType,
        status,
        apartmentId,
      });

      res.json({
        items,
        total,         // ✅ important
        page: safePage,
        pageSize: safePageSize,
      });
    } catch (error) {
      console.error("Error fetching properties:", error);
      res.status(500).json({ message: "Failed to fetch properties" });
    }
  });

  app.get("/api/properties/images", async (req, res) => {
    const idsParam = String(req.query.ids || "").trim();
    if (!idsParam) return res.json({});

    const ids = idsParam.split(",").map(s => s.trim()).filter(Boolean);

    const rows = await storage.getPropertyImagesByIds(ids);

    // convert to { [id]: images[] }
    const map: Record<string, string[]> = {};
    for (const r of rows) {
      map[r.id] = Array.isArray(r.images) ? r.images : [];
    }

    res.json(map);
  });

  app.post("/api/properties", async (req, res) => {
    try {
      const validated = insertPropertySchema.parse(req.body);

      // If transaction type is NOT Rent → always clear dates
      if (validated.transactionType !== "Rent") {
        validated.agreementStartDate = undefined;
        validated.agreementEndDate = undefined;
      } else {
        const hasStart = !!validated.agreementStartDate;
        const hasEnd = !!validated.agreementEndDate;

        if ((hasStart && !hasEnd) || (!hasStart && hasEnd)) {
          return res.status(400).json({
            message:
              "Please provide both agreement start and end dates, or leave both empty.",
          });
        }

        if (hasStart && hasEnd) {
          const start = new Date(validated.agreementStartDate as any);
          const end = new Date(validated.agreementEndDate as any);

          if (
            isNaN(start.getTime()) ||
            isNaN(end.getTime()) ||
            end <= start
          ) {
            return res.status(400).json({
              message:
                "Agreement end date must be after agreement start date.",
            });
          }
        }
      }

      const property = await storage.createProperty(validated);
      // 🔍 EMAIL DEBUG (CREATE)
      console.log("EMAIL DEBUG (CREATE): ownerId =", validated.ownerId);

      // Send email to owner if ownerId exists
      if (validated.ownerId) {
        try {
          const owner = await storage.getOwner(validated.ownerId);

          // 🔍 EMAIL DEBUG (CREATE)
          console.log("EMAIL DEBUG (CREATE): owner email =", owner?.email);

          if (owner && owner.email) {
            sendOwnerRegistrationEmail(owner.email, owner.name)
              .catch((e) =>
                console.error("Owner email failed (create):", e)
              );
          }
        } catch (e) {
          console.error("Owner lookup failed (create):", e);
        }
      }

      res.status(201).json(property);
    } catch (error) {
      console.error("❌ Error creating property:", error);
      res.status(400).json({ message: "Failed to create property" });
    }
  });

  app.patch("/api/properties/:id", async (req, res) => {
    try {
      const body: any = { ...req.body };

      const rawStart = body.agreementStartDate;
      const rawEnd = body.agreementEndDate;

      if (!rawStart) body.agreementStartDate = null;
      if (!rawEnd) body.agreementEndDate = null;

      if (body.transactionType && body.transactionType !== "Rent") {
        body.agreementStartDate = null;
        body.agreementEndDate = null;
      } else if (body.transactionType === "Rent" || !body.transactionType) {
        const hasStart = !!rawStart;
        const hasEnd = !!rawEnd;

        if ((hasStart && !hasEnd) || (!hasStart && hasEnd)) {
          return res.status(400).json({
            message:
              "Please provide both agreement start and end dates, or leave both empty.",
          });
        }

        if (hasStart && hasEnd) {
          const start = new Date(rawStart);
          const end = new Date(rawEnd);

          if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
            return res.status(400).json({
              message: "Agreement end date must be after agreement start date.",
            });
          }

          body.agreementStartDate = start;
          body.agreementEndDate = end;
        } else {
          body.agreementStartDate = null;
          body.agreementEndDate = null;
        }
      }

      // ✅ 1) Get old property BEFORE update (to detect owner attach/change)
      const oldProperty = await storage.getProperty(req.params.id);

      // 🔍 EMAIL DEBUG (PATCH)
      console.log(
        "EMAIL DEBUG (PATCH): oldOwnerId =",
        oldProperty?.ownerId
      );

      // ✅ 2) Update property
      const property = await storage.updateProperty(req.params.id, body);

      // 🔍 EMAIL DEBUG (PATCH)
      console.log(
        "EMAIL DEBUG (PATCH): newOwnerId =",
        body.ownerId
      );


      // ✅ 3) Send email ONLY if ownerId is newly attached/changed
      const newOwnerId = body.ownerId;
      const oldOwnerId = oldProperty?.ownerId ?? null;

      if (newOwnerId && newOwnerId !== oldOwnerId) {
        try {
          const owner = await storage.getOwner(newOwnerId);

          // 🔍 EMAIL DEBUG (PATCH)
          console.log("EMAIL DEBUG (PATCH): owner email =", owner?.email);

          if (owner?.email) {
            // Don't block API response if email fails
            sendOwnerRegistrationEmail(owner.email, owner.name).catch((e) =>
              console.error("Owner email failed (update):", e)
            );
          }
        } catch (e) {
          console.error("Owner lookup failed (update):", e);
        }
      }

      res.json(property);
    } catch (error: any) {
      console.error("❌ Error updating property:", error);
      res.status(400).json({ message: error?.message || "Failed to update property" });
    }
  });

  // Set cover image for a property
  app.patch("/api/properties/:id/cover-image", async (req, res) => {
    try {
      const propertyId = req.params.id;
      const { index } = req.body as { index?: number };

      if (index === undefined) {
        return res.status(400).json({ message: "Image index is required" });
      }

      const property = await storage.getProperty(propertyId);

      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      const images = Array.isArray(property.images)
        ? [...property.images]
        : [];

      if (images.length === 0) {
        return res.status(400).json({ message: "No images to reorder" });
      }

      if (index < 0 || index >= images.length) {
        return res.status(400).json({ message: "Invalid image index" });
      }

      // Move selected image to the front (index 0)
      const [selected] = images.splice(index, 1);
      images.unshift(selected);

      const updated = await storage.updateProperty(propertyId, {
        images,
      } as any);

      res.json(updated);
    } catch (error) {
      console.error("Error setting cover image:", error);
      res.status(500).json({ message: "Failed to set cover image" });
    }
  });


  app.delete("/api/properties/:id", async (req, res) => {
    try {
      await storage.deleteProperty(req.params.id);
      res.status(200).json({ message: "Property deleted successfully" });
    } catch (error) {
      console.error("❌ Error deleting property:", error);
      res.status(500).json({ message: "Failed to delete property" });
    }
  });

  // Owner routes
  app.get("/api/owners", async (req, res) => {
    try {
      const owners = await storage.getOwners();
      res.json(owners);
    } catch (error) {
      console.error("Error fetching owners:", error);
      res.status(500).json({ message: "Failed to fetch owners" });
    }
  });

  app.post("/api/owners", async (req, res) => {
    try {
      console.log("📩 Incoming Owner Data:", req.body);

      const validated = insertOwnerSchema.parse(req.body);
      const owner = await storage.createOwner(validated);
      res.status(201).json(owner);
    } catch (error) {
      console.error("Error creating owner:", error);
      res.status(400).json({ message: "Failed to create owner" });
    }
  });

  app.patch("/api/owners/:id", async (req, res) => {
    try {
      const validated = insertOwnerSchema.partial().parse(req.body);
      const owner = await storage.updateOwner(req.params.id, validated);
      res.json(owner);
    } catch (error) {
      console.error("Error updating owner:", error);
      res.status(400).json({ message: "Failed to update owner" });
    }
  });

  app.delete("/api/owners/:id", async (req, res) => {
    try {
      await storage.deleteOwner(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting owner:", error);
      res.status(500).json({ message: "Failed to delete owner" });
    }
  });

  // Apartment routes
  app.get("/api/apartments", async (req, res) => {
    try {
      const apartments = await storage.getApartments();
      res.json(apartments);
    } catch (error) {
      console.error("Error fetching apartments:", error);
      res.status(500).json({ message: "Failed to fetch apartments" });
    }
  });

  app.post("/api/apartments", async (req, res) => {
    try {
      const validated = insertApartmentSchema.parse(req.body);
      const apt = await storage.createApartment(validated);
      res.status(201).json(apt);
    } catch (error) {
      console.error("Error creating apartment:", error);
      res.status(400).json({ message: "Failed to create apartment" });
    }
  });

  app.patch("/api/apartments/:id", async (req, res) => {
    try {
      const validated = insertApartmentSchema.partial().parse(req.body);
      const apt = await storage.updateApartment(req.params.id, validated);
      res.json(apt);
    } catch (error) {
      console.error("Error updating apartment:", error);
      res.status(400).json({ message: "Failed to update apartment" });
    }
  });

  app.delete("/api/apartments/:id", async (req, res) => {
    try {
      await storage.deleteApartment(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting apartment:", error);
      res.status(500).json({ message: "Failed to delete apartment" });
    }
  });


  // Project Owner routes
  app.get("/api/project-owners", async (req, res) => {
    try {
      const items = await storage.getProjectOwners();
      res.json(items);
    } catch (error) {
      console.error("Error fetching project owners:", error);
      res.status(500).json({ message: "Failed to fetch project owners" });
    }
  });

  app.post("/api/project-owners", async (req, res) => {
    try {
      const validated = insertProjectOwnerSchema.parse(req.body);
      const created = await storage.createProjectOwner(validated);
      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating project owner:", error);
      res.status(400).json({ message: "Failed to create project owner" });
    }
  });

  app.patch("/api/project-owners/:id", async (req, res) => {
    try {
      const validated = insertProjectOwnerSchema.partial().parse(req.body);
      const updated = await storage.updateProjectOwner(req.params.id, validated);
      res.json(updated);
    } catch (error) {
      console.error("Error updating project owner:", error);
      res.status(400).json({ message: "Failed to update project owner" });
    }
  });

  app.delete("/api/project-owners/:id", async (req, res) => {
    try {
      await storage.deleteProjectOwner(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting project owner:", error);
      res.status(500).json({ message: "Failed to delete project owner" });
    }
  });


  // Projects routes
  app.get("/api/projects", async (req, res) => {
    try {
      const items = await storage.getProjects();
      res.json(items);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const validated = insertProjectSchema.parse(req.body);
      const created = await storage.createProject(validated);
      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(400).json({ message: "Failed to create project" });
    }
  });

  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const validated = insertProjectSchema.partial().parse(req.body);
      const updated = await storage.updateProject(req.params.id, validated);
      res.json(updated);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(400).json({ message: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      await storage.deleteProject(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // ✅ Get single project by id (needed by Project Status page)
  app.get("/api/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });


  // Status routes
  app.patch("/api/projects/:id/status", async (req, res) => {
    try {
      const projectId = req.params.id;
      const status = typeof req.body?.status === "string" ? req.body.status : null;
      const updated = await storage.updateProjectStatus(projectId, status);
      res.json(updated);
    } catch (error) {
      console.error("Error updating project status:", error);
      res.status(400).json({ message: "Failed to update project status" });
    }
  });


  // Towers routes
  app.get("/api/projects/:id/towers", async (req, res) => {
    try {
      const rows = await storage.getProjectTowers(req.params.id);
      res.json(rows);
    } catch (e) {
      console.error("Error fetching project towers:", e);
      res.status(500).json({ message: "Failed to fetch project towers" });
    }
  });

  app.post("/api/projects/:id/towers", async (req, res) => {
    try {
      const validated = insertProjectTowerSchema.parse({ ...req.body, projectId: req.params.id });
      const row = await storage.createProjectTower(validated);
      res.status(201).json(row);
    } catch (e) {
      console.error("Error creating project tower:", e);
      res.status(400).json({ message: "Failed to create project tower" });
    }
  });

  app.patch("/api/project-towers/:towerId", async (req, res) => {
    try {
      const validated = insertProjectTowerSchema.partial().parse(req.body);
      const row = await storage.updateProjectTower(req.params.towerId, validated);
      res.json(row);
    } catch (e) {
      console.error("Error updating project tower:", e);
      res.status(400).json({ message: "Failed to update project tower" });
    }
  });

  app.delete("/api/project-towers/:towerId", async (req, res) => {
    try {
      await storage.deleteProjectTower(req.params.towerId);
      res.status(204).send();
    } catch (e) {
      console.error("Error deleting project tower:", e);
      res.status(500).json({ message: "Failed to delete project tower" });
    }
  });

  // Unit configs routes

  app.get("/api/projects/:id/unit-configs", async (req, res) => {
    try {
      const rows = await storage.getProjectUnitConfigs(req.params.id);
      res.json(rows);
    } catch (e) {
      console.error("Error fetching unit configs:", e);
      res.status(500).json({ message: "Failed to fetch unit configs" });
    }
  });

  app.post("/api/projects/:projectId/unit-configs", async (req, res) => {
    try {
      const validated = insertProjectUnitConfigSchema.parse(req.body);
      const row = await storage.createProjectUnitConfig({
        ...validated,
        projectId: req.params.projectId,
      });
      res.status(201).json(row);
    } catch (e) {
      console.error("Error creating unit config:", e);

      if (e instanceof ZodError) {
        return res.status(400).json({
          message: "Validation failed",
          issues: e.issues,
        });
      }

      res.status(400).json({ message: "Failed to create unit config" });
    }
  });

  app.patch("/api/project-unit-configs/:configId", async (req, res) => {
    try {
      const validated = insertProjectUnitConfigSchema.partial().parse(req.body);
      const row = await storage.updateProjectUnitConfig(req.params.configId, validated);
      res.json(row);
    } catch (e) {
      console.error("Error updating unit config:", e);
      res.status(400).json({ message: "Failed to update unit config" });
    }
  });

  app.delete("/api/project-unit-configs/:configId", async (req, res) => {
    try {
      await storage.deleteProjectUnitConfig(req.params.configId);
      res.status(204).send();
    } catch (e) {
      console.error("Error deleting unit config:", e);
      res.status(500).json({ message: "Failed to delete unit config" });
    }
  });

  // Images routes

  app.get("/api/projects/:id/images", async (req, res) => {
    try {
      const rows = await storage.getProjectImages(req.params.id);
      res.json(rows);
    } catch (e) {
      console.error("Error fetching project images:", e);
      res.status(500).json({ message: "Failed to fetch project images" });
    }
  });

  app.post("/api/projects/:id/images", async (req, res) => {
    try {
      const validated = insertProjectImageSchema.parse({ ...req.body, projectId: req.params.id });
      const row = await storage.addProjectImage(validated);
      res.status(201).json(row);
    } catch (e) {
      console.error("Error adding project image:", e);
      res.status(400).json({ message: "Failed to add project image" });
    }
  });

  app.delete("/api/project-images/:imageId", async (req, res) => {
    try {
      await storage.deleteProjectImage(req.params.imageId);
      res.status(204).send();
    } catch (e) {
      console.error("Error deleting project image:", e);
      res.status(500).json({ message: "Failed to delete project image" });
    }
  });

  app.patch("/api/projects/:id/images/:imageId/default", async (req, res) => {
    try {
      await storage.setDefaultProjectImage(req.params.id, req.params.imageId);
      res.status(200).json({ ok: true });
    } catch (e) {
      console.error("Error setting default image:", e);
      res.status(500).json({ message: "Failed to set default image" });
    }
  });

  app.get("/api/project-images/:imageId/download", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const imageId = req.params.imageId;

      const img = await storage.getProjectImage(imageId);
      if (!img) return res.status(404).json({ message: "Image not found" });

      const u = String(img.imageUrl || "");

      // Local uploads
      if (u.startsWith("local-uploads/")) {
        const uploadsDir = path.resolve(process.cwd(), "local_uploads");
        const fileId = u.split("/").slice(1).join("/");
        const filePath = path.join(uploadsDir, fileId);

        if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File not found" });

        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Disposition", `attachment; filename="project-image-${imageId}.jpg"`);
        return fs.createReadStream(filePath).pipe(res);
      }

      // Object storage
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(u);

      const canAccess = await objectStorageService.canAccessObjectEntity({ userId, objectFile });
      if (!canAccess) return res.status(403).json({ message: "Access denied" });

      res.setHeader("Content-Disposition", `attachment; filename="project-image-${imageId}"`);
      return objectStorageService.downloadObject(objectFile, res);
    } catch (e) {
      console.error("Error downloading project image:", e);
      res.status(500).json({ message: "Failed to download image" });
    }
  });

  // View project image (streams the file)
  app.get(
    "/api/project-images/:imageId/view",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const imageId = req.params.imageId;
        const img = await storage.getProjectImage(imageId);

        if (!img) {
          return res.status(404).json({ message: "Image not found" });
        }

        // ✅ LOCAL uploads
        if (img.imageUrl?.startsWith("local-uploads/")) {
          const uploadsDir = path.resolve(process.cwd(), "local_uploads");
          const fileId = img.imageUrl.replace("local-uploads/", "");
          const filePath = path.join(uploadsDir, fileId);

          if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: "File not found" });
          }

          const stat = fs.statSync(filePath);

          // ✅ real content-type from file extension
          const contentType =
            (mime.lookup(filePath) as string) || "application/octet-stream";

          res.set({
            "Content-Type": contentType,
            "Content-Length": stat.size,
            // ✅ inline + filename helps browsers open it
            "Content-Disposition": `inline; filename="${path.basename(filePath)}"`,
            "Cache-Control": "private, max-age=3600",
          });

          return fs.createReadStream(filePath).pipe(res);
        }

        // ✅ OBJECT STORAGE
        const objectStorageService = new ObjectStorageService();
        const objectFile = await objectStorageService.getObjectEntityFile(img.imageUrl);

        const canAccess = await objectStorageService.canAccessObjectEntity({
          userId: req.user.claims.sub,
          objectFile,
        });

        if (!canAccess) {
          return res.status(403).json({ message: "Access denied" });
        }

        const [metadata] = await objectFile.getMetadata();

        res.set({
          "Content-Type": metadata.contentType || "application/octet-stream",
          "Content-Disposition": `inline; filename="${img.id}"`,
          "Cache-Control": "private, max-age=3600",
        });

        objectFile.createReadStream().pipe(res);
      } catch (e) {
        console.error("Error viewing project image:", e);
        res.status(500).json({ message: "Failed to view image" });
      }
    }
  );


  app.post("/api/projects/:id/images/upload", isAuthenticated, upload.array("files"), async (req: any, res) => {
    try {
      const projectId = req.params.id;
      const files = (req.files || []) as Express.Multer.File[];

      // Optional: allow empty (since UI says optional)
      if (!files.length) return res.status(200).json([]);

      // Create DB rows for each uploaded file
      const createdRows = [];
      for (const f of files) {
        const fileUrl = `local-uploads/${path.basename(f.filename)}`;
        const row = await storage.addProjectImage({
          projectId,
          imageUrl: fileUrl,
          isDefault: false,
        });
        createdRows.push(row);
      }

      return res.status(201).json(createdRows);
    } catch (e) {
      console.error("Error uploading project images:", e);
      return res.status(400).json({ message: "Failed to upload project images" });
    }
  });

  // Documents routes

  app.get("/api/projects/:id/documents", async (req, res) => {
    try {
      const rows = await storage.getProjectDocuments(req.params.id);
      res.json(rows);
    } catch (e) {
      console.error("Error fetching project documents:", e);
      res.status(500).json({ message: "Failed to fetch project documents" });
    }
  });

  app.post("/api/projects/:id/documents", async (req, res) => {
    try {
      const validated = insertProjectDocumentSchema.parse({
        projectId: req.params.id,
        name: req.body.name ?? req.body.fileName,
        fileUrl: req.body.fileUrl,
        fileType: req.body.fileType ?? "",
        fileName: req.body.fileName ?? "",
        mimeType: req.body.mimeType ?? "",
      });

      const row = await storage.createProjectDocument(validated);
      res.status(201).json(row);
    } catch (e: any) {
      console.error("❌ Error creating project document:", e);
      return res.status(400).json({ message: "Failed to create project document", error: e?.message || e });
    }
  });

  app.patch("/api/project-documents/:docId", async (req, res) => {
    try {
      const validated = insertProjectDocumentSchema.partial().parse(req.body);
      const row = await storage.updateProjectDocument(req.params.docId, validated);
      res.json(row);
    } catch (e) {
      console.error("Error updating project document:", e);
      res.status(400).json({ message: "Failed to update project document" });
    }
  });

  app.delete("/api/project-documents/:docId", async (req, res) => {
    try {
      await storage.deleteProjectDocument(req.params.docId);
      res.status(204).send();
    } catch (e) {
      console.error("Error deleting project document:", e);
      res.status(500).json({ message: "Failed to delete project document" });
    }
  });

  app.post(
    "/api/projects/:projectId/documents/upload",
    isAuthenticated,
    upload.array("files"),
    async (req: any, res) => {
      try {
        const { projectId } = req.params;
        const { name } = req.body;
        const files = req.files as Express.Multer.File[];

        if (!name) {
          return res.status(400).json({ message: "Name is required" });
        }

        if (!files || files.length === 0) {
          return res.status(400).json({ message: "No files uploaded" });
        }

        const savedDocs = [];

        for (const file of files) {
          const fileUrl = `/uploads/documents/${file.filename}`;

          const doc = await storage.createProjectDocument({
            projectId,
            name,
            fileUrl,
            fileType: file.mimetype,       // optional, or set extension
            fileName: file.originalname,   // ✅ now valid
            mimeType: file.mimetype,       // ✅ now valid
          });

          savedDocs.push(doc);
        }

        res.json(savedDocs);
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to upload documents" });
      }
    }
  );

  // ✅ View project document (inline - good for PDFs)
  app.get("/api/project-documents/:docId/view", isAuthenticated, async (req: any, res) => {
    try {
      const doc = await storage.getProjectDocument(req.params.docId);
      if (!doc) return res.status(404).json({ message: "Document not found" });

      // Local uploads
      if (doc.fileUrl?.startsWith("local-uploads/")) {
        const uploadsDir = path.resolve(process.cwd(), "local_uploads");
        const fileId = doc.fileUrl.split("/").slice(1).join("/");
        const filePath = path.join(uploadsDir, fileId);

        if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File not found" });

        const stat = fs.statSync(filePath);
        res.set({
          "Content-Type": doc.mimeType || "application/octet-stream",
          "Content-Length": stat.size,
          "Content-Disposition": `inline; filename="${doc.fileName || "document"}"`,
          "Cache-Control": "private, max-age=3600",
        });
        return fs.createReadStream(filePath).pipe(res);
      }

      // Object storage
      const objectStorageService = new ObjectStorageService();
      if (!doc.fileUrl) {
        return res.status(400).json({ message: "Document has no fileUrl" });
      }
      const objectFile = await objectStorageService.getObjectEntityFile(doc.fileUrl);

      const canAccess = await objectStorageService.canAccessObjectEntity({
        userId: req.user.claims.sub,
        objectFile,
      });
      if (!canAccess) return res.status(403).json({ message: "Access denied" });

      const [metadata] = await objectFile.getMetadata();
      res.set({
        "Content-Type": doc.mimeType || metadata.contentType || "application/octet-stream",
        "Content-Length": metadata.size,
        "Content-Disposition": `inline; filename="${doc.fileName || "document"}"`,
        "Cache-Control": "private, max-age=3600",
      });

      objectFile.createReadStream().pipe(res);
    } catch (e) {
      console.error("Error viewing project document:", e);
      res.status(500).json({ message: "Failed to view document" });
    }
  });

  // ✅ Download project document (attachment)
  app.get("/api/project-documents/:docId/download", isAuthenticated, async (req: any, res) => {
    try {
      const doc = await storage.getProjectDocument(req.params.docId);
      if (!doc) return res.status(404).json({ message: "Document not found" });

      // Local uploads
      if (doc.fileUrl?.startsWith("local-uploads/")) {
        const uploadsDir = path.resolve(process.cwd(), "local_uploads");
        const fileId = doc.fileUrl.split("/").slice(1).join("/");
        const filePath = path.join(uploadsDir, fileId);

        if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File not found" });

        res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
        res.setHeader("Content-Disposition", `attachment; filename="${doc.fileName || "document"}"`);
        return fs.createReadStream(filePath).pipe(res);
      }

      // Object storage
      const objectStorageService = new ObjectStorageService();
      if (!doc.fileUrl) {
        return res.status(400).json({ message: "Document has no fileUrl" });
      }
      const objectFile = await objectStorageService.getObjectEntityFile(doc.fileUrl);

      const canAccess = await objectStorageService.canAccessObjectEntity({
        userId: req.user.claims.sub,
        objectFile,
      });
      if (!canAccess) return res.status(403).json({ message: "Access denied" });

      res.setHeader("Content-Disposition", `attachment; filename="${doc.fileName || "document"}"`);
      return objectStorageService.downloadObject(objectFile, res);
    } catch (e) {
      console.error("Error downloading project document:", e);
      res.status(500).json({ message: "Failed to download document" });
    }
  });

  // Client routes
  app.get("/api/clients", async (req, res) => {
    try {
      const clients = await storage.getClients();
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  app.post("/api/clients", async (req, res) => {
    try {
      const validated = insertClientSchema.parse(req.body);
      const client = await storage.createClient(validated);
      res.status(201).json(client);
    } catch (error) {
      console.error("Error creating client:", error);
      res.status(400).json({ message: "Failed to create client" });
    }
  });

  app.patch("/api/clients/:id", async (req, res) => {
    try {
      const validated = insertClientSchema.partial().parse(req.body);
      const client = await storage.updateClient(req.params.id, validated);
      res.json(client);
    } catch (error) {
      console.error("Error updating client:", error);
      res.status(400).json({ message: "Failed to update client" });
    }
  });

  app.delete("/api/clients/:id", async (req, res) => {
    try {
      await storage.deleteClient(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting client:", error);
      res.status(500).json({ message: "Failed to delete client" });
    }
  });

  // Dashboard routes
  app.get("/api/dashboard/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const stats = await storage.getDashboardStats();

      // For Sales Agents and Marketing Executives, filter stats to only their assigned leads
      if (user.role === "Sales Agent" || user.role === "Marketing Executive") {
        const allLeads = await storage.getLeads();
        const myLeads = allLeads.filter((lead) => lead.assignedTo === userId);
        const closedLeads = myLeads.filter(
          (lead) => lead.stage === "Closed"
        );
        const activeLeads = myLeads.filter((lead) => lead.stage !== "Closed");

        const filteredStats = {
          totalLeads: myLeads.length,
          activeLeads: activeLeads.length,
          closedDeals: closedLeads.length,
          totalRevenue: stats.totalRevenue,
          totalProperties: stats.totalProperties,
          availableProperties: stats.availableProperties,
        };
        return res.json(filteredStats);
      }

      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get("/api/rent-agreements/ending-soon", isAuthenticated, async (req, res) => {
    try {
      const daysRaw = Number(req.query.days ?? "30");
      const days = Number.isFinite(daysRaw) && daysRaw > 0 ? daysRaw : 30;

      const rows = await storage.getRentAgreementsEndingSoon(days);
      return res.json(rows);
    } catch (error: any) {
      console.error("Error fetching ending soon agreements:", error);

      return res.status(500).json({
        message: "Failed to fetch ending soon agreements",
        error: error?.message ?? String(error),
      });
    }
  });

  app.get("/api/dashboard/expiring-agreements", async (req, res) => {
    try {
      const daysRaw = Number(req.query.days ?? "30");
      const days = Number.isFinite(daysRaw) && daysRaw > 0 ? daysRaw : 30;

      const rows = await storage.getRentAgreementsEndingSoon(days);
      return res.json(rows);
    } catch (error: any) {
      console.error("Error fetching expiring agreements:", error);
      return res.status(500).json({
        message: "Failed to fetch expiring agreements",
        error: error?.message ?? String(error),
      });
    }
  });

  app.get("/api/dashboard/pending-sell-brokerage", async (req, res) => {
    try {
      const limit = Number(req.query.limit ?? 10);
      const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 50) : 10;

      const rows = await storage.getPendingSellBrokerageAgreements(safeLimit);
      res.json(rows);
    } catch (error: any) {
      console.error("❌ pending sell brokerage error:", error);
      res.status(500).json({
        message: "Failed to fetch pending sell brokerage agreements",
        error: error?.message || String(error),
      });
    }
  });

  app.get("/api/dashboard/sales", async (req, res) => {
    try {
      const salesData = await storage.getSalesData();
      res.json(salesData);
    } catch (error) {
      console.error("Error fetching sales data:", error);
      res.status(500).json({ message: "Failed to fetch sales data" });
    }
  });

  app.get("/api/dashboard/lead-sources", async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      if (user.role === "Sales Agent" || user.role === "Marketing Executive") {
        const allLeads = await storage.getLeads();
        const myLeads = allLeads.filter((lead) => lead.assignedTo === userId);

        const sourceMap = myLeads.reduce((acc, lead) => {
          acc[lead.source] = (acc[lead.source] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const filteredSourceData = Object.entries(sourceMap).map(
          ([source, count]) => ({
            source,
            count,
          })
        );

        return res.json(filteredSourceData);
      }

      const leadSourceData = await storage.getLeadSourceData();
      res.json(leadSourceData);
    } catch (error) {
      console.error("Error fetching lead source data:", error);
      res.status(500).json({ message: "Failed to fetch lead source data" });
    }
  });

  app.get("/api/dashboard/top-agents", async (req, res) => {
    try {
      const topAgents = await storage.getTopAgents();
      res.json(topAgents);
    } catch (error) {
      console.error("Error fetching top agents:", error);
      res.status(500).json({ message: "Failed to fetch top agents" });
    }
  });

  app.get("/api/dashboard/recent-activities", async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const activities = await storage.getRecentActivities(10);

      if (user.role === "Sales Agent" || user.role === "Marketing Executive") {
        const allLeads = await storage.getLeads();
        const myLeadIds = allLeads
          .filter((lead) => lead.assignedTo === userId)
          .map((lead) => lead.id)
          .filter((id): id is string => id !== null);

        const myActivities = activities.filter(
          (activity) => activity.leadId && myLeadIds.includes(activity.leadId)
        );

        const formattedActivities = myActivities.map((activity) => ({
          ...activity,
          timeAgo: getTimeAgo(new Date(activity.createdAt!)),
        }));

        return res.json(formattedActivities);
      }

      const formattedActivities = activities.map((activity) => ({
        ...activity,
        timeAgo: getTimeAgo(new Date(activity.createdAt!)),
      }));
      res.json(formattedActivities);
    } catch (error) {
      console.error("Error fetching recent activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  app.get("/api/dashboard/daily-activities", async (req, res) => {
    try {
      const dailyActivities = await storage.getDailyExecutiveActivities();
      res.json(dailyActivities);
    } catch (error) {
      console.error("Error fetching daily activities:", error);
      res.status(500).json({ message: "Failed to fetch daily activities" });
    }
  });

  // Contact submission routes
  app.get("/api/contact-submissions", async (req, res) => {
    try {
      const submissions = await storage.getContactSubmissions();
      res.json(submissions);
    } catch (error) {
      console.error("Error fetching contact submissions:", error);
      res.status(500).json({ message: "Failed to fetch submissions" });
    }
  });

  app.post("/api/contact-submissions", async (req, res) => {
    try {
      const validated = insertContactSubmissionSchema.parse(req.body);
      const submission = await storage.createContactSubmission(validated);
      res.status(201).json(submission);
    } catch (error) {
      console.error("Error creating contact submission:", error);
      res.status(400).json({ message: "Failed to create submission" });
    }
  });

  app.post("/api/contact-submissions/convert", async (req, res) => {
    try {
      const { submissionId } = req.body;
      const submissions = await storage.getContactSubmissions();
      const submission = submissions.find((s) => s.id === submissionId);

      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      const lead = await storage.createLead({
        name: submission.name,
        phone: submission.phone,
        email: submission.email,
        source: "Website",
        stage: "New",
      });

      res.status(201).json(lead);
    } catch (error) {
      console.error("Error converting submission to lead:", error);
      res.status(500).json({ message: "Failed to convert to lead" });
    }
  });

  // Reports and export routes



  app.get("/api/reports/summary", isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      const topAgents = await storage.getTopAgents();
      const conversionRate =
        stats.totalLeads > 0
          ? Math.round((stats.closedDeals / stats.totalLeads) * 100)
          : 0;

      res.json({
        totalLeads: stats.totalLeads,
        totalProperties: stats.totalProperties,
        conversionRate,
        agentPerformance: topAgents.map((agent) => ({
          ...agent,
          role: "Sales Agent",
          revenue: Math.floor(Math.random() * 5000000) + 1000000,
        })),
      });
    } catch (error) {
      console.error("Error fetching report summary:", error);
      res.status(500).json({ message: "Failed to fetch report" });
    }
  });

  app.get("/api/reports/export/:type", isAuthenticated, async (req, res) => {
    try {
      const { type } = req.params;
      let csvData = "";

      const csvEscape = (value: any) => {
        if (value === null || value === undefined) return "";
        if (value instanceof Date) value = value.toISOString();

        const str = String(value);

        // If value contains comma, quote, or newline → wrap in quotes and escape quotes
        if (/[",\n\r]/.test(str)) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      if (type === "leads") {
        const leads = await storage.getLeads();
        csvData = "Name,Phone,Email,Source,Budget,Location,Stage\n";
        leads.forEach((lead) => {
          csvData += `${lead.name},${lead.phone},${lead.email || ""},${lead.source
            },${lead.budget || ""},${lead.preferredLocation || ""},${lead.stage
            }\n`;
        });
      } else if (type === "properties") {
        // ✅ fetch all properties (your storage.getProperties() already returns full dataset if no limit)
        const properties = await storage.getProperties();

        if (!properties || properties.length === 0) {
          csvData = "No data\n";
        } else {
          // ✅ export ALL keys (all columns returned by storage)
          const columns = Object.keys(properties[0]);

          csvData = `${columns.join(",")}\n`;

          for (const row of properties as any[]) {
            csvData += `${columns.map((c) => csvEscape(row[c])).join(",")}\n`;
          }
        }
      } else if (type === "sales") {
        const stats = await storage.getDashboardStats();
        csvData = "Metric,Value\n";
        csvData += `Total Leads,${stats.totalLeads}\n`;
        csvData += `Closed Deals,${stats.closedDeals}\n`;
        csvData += `Total Revenue,${stats.totalRevenue}\n`;
      }

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${type}_report.csv`
      );
      res.send(csvData);
    } catch (error) {
      console.error("Error exporting data:", error);
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  app.post(
    "/api/import/leads",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        console.log(
          "🔐 /api/import/leads called - session:",
          (req.session as any) ? true : false,
          "cookie:",
          req.headers.cookie
        );
        console.log("🔐 req.user:", req.user);
        const leadsData = req.body.data;
        const result = await storage.bulkImportLeads(leadsData);
        res.json(result);
      } catch (error) {
        console.error("Error importing leads:", error);
        res.status(500).json({
          inserted: 0,
          updated: 0,
          errors: [
            {
              row: 0,
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to import leads",
            },
          ],
        });
      }
    }
  );

  app.post("/api/import/properties", isAdmin, async (req, res) => {
    try {
      console.log(
        "🔐 /api/import/properties called - session:",
        (req.session as any) ? true : false,
        "cookie:",
        req.headers.cookie
      );
      console.log("🔐 req.user:", req.user);
      console.log(
        "🏢 Import properties request received, rows:",
        req.body.data?.length || 0
      );
      const propertiesData = req.body.data;
      if (propertiesData && propertiesData.length > 0) {
        console.log(
          "📋 First property sample:",
          JSON.stringify(propertiesData[0], null, 2)
        );
      }
      const result = await storage.bulkImportProperties(propertiesData);
      console.log("✅ Import properties result:", result);
      res.json(result);
    } catch (error) {
      console.error("❌ Error importing properties:", error);
      res.status(500).json({
        inserted: 0,
        updated: 0,
        errors: [
          {
            row: 0,
            error:
              error instanceof Error
                ? error.message
                : "Failed to import properties",
          },
        ],
      });
    }
  });

  app.post(
    "/api/import/owners",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        console.log(
          "🔐 /api/import/owners called - session:",
          (req.session as any) ? true : false,
          "cookie:",
          req.headers.cookie
        );
        console.log("🔐 req.user:", req.user);
        const ownersData = req.body.data;
        const result = await storage.bulkImportOwners(ownersData);
        res.json(result);
      } catch (error) {
        console.error("Error importing owners:", error);
        res.status(500).json({
          inserted: 0,
          updated: 0,
          errors: [
            {
              row: 0,
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to import owners",
            },
          ],
        });
      }
    }
  );

  app.post(
    "/api/import/clients",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        console.log(
          "🔐 /api/import/clients called - session:",
          (req.session as any) ? true : false,
          "cookie:",
          req.headers.cookie
        );
        console.log("🔐 req.user:", req.user);
        const clientsData = req.body.data;
        const result = await storage.bulkImportClients(clientsData);
        res.json(result);
      } catch (error) {
        console.error("Error importing clients:", error);
        res.status(500).json({
          inserted: 0,
          updated: 0,
          errors: [
            {
              row: 0,
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to import clients",
            },
          ],
        });
      }
    }
  );

  // Document attachment routes
  const objectStorageService = new ObjectStorageService();

  // Get presigned upload URL
  app.get(
    "/api/project-images/:imageId/view",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const imageId = req.params.imageId;
        const img = await storage.getProjectImage(imageId);

        if (!img) {
          return res.status(404).json({ message: "Image not found" });
        }

        // ✅ LOCAL UPLOADS
        if (img.imageUrl?.startsWith("local-uploads/")) {
          const uploadsDir = path.resolve(process.cwd(), "local_uploads");
          const filePath = path.join(uploadsDir, img.imageUrl.replace("local-uploads/", ""));

          if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: "File not found" });
          }

          const contentType =
            mime.lookup(filePath) || "image/jpeg";

          res.setHeader("Content-Type", contentType);
          res.setHeader("Content-Disposition", "inline");
          res.setHeader("Cache-Control", "private, max-age=3600");

          return fs.createReadStream(filePath).pipe(res);
        }

        // ✅ OBJECT STORAGE
        const objectStorageService = new ObjectStorageService();
        const objectFile = await objectStorageService.getObjectEntityFile(img.imageUrl);

        const canAccess = await objectStorageService.canAccessObjectEntity({
          userId: req.user.claims.sub,
          objectFile,
        });

        if (!canAccess) {
          return res.status(403).json({ message: "Access denied" });
        }

        const [metadata] = await objectFile.getMetadata();

        res.setHeader(
          "Content-Type",
          metadata.contentType || "image/jpeg"
        );
        res.setHeader("Content-Disposition", "inline");
        res.setHeader("Cache-Control", "private, max-age=3600");

        objectFile.createReadStream().pipe(res);
      } catch (e) {
        console.error("Error viewing project image:", e);
        res.status(500).json({ message: "Failed to view image" });
      }
    }
  );

  // ✅ Returns an uploadUrl + fileUrl for document uploads
  app.get("/api/documents/upload-url", isAuthenticated, async (req: any, res) => {
    try {
      const fileName = req.query.fileName ? String(req.query.fileName) : "";
      const mimeType = req.query.mimeType ? String(req.query.mimeType) : "application/octet-stream";

      const id = randomUUID();

      // keep same file naming logic as upload-proxy (id + extension)
      const ext = fileName ? path.extname(fileName) : "";
      const finalFileName = `${id}${ext}`;

      const uploadUrl =
        `/api/documents/upload-proxy/${id}` +
        `?fileName=${encodeURIComponent(fileName)}` +
        `&mimeType=${encodeURIComponent(mimeType)}`;

      const fileUrl = `local-uploads/${finalFileName}`;

      return res.json({ uploadUrl, fileUrl });
    } catch (error) {
      console.error("Error generating upload-url:", error);
      return res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });


  // Upload proxy for local DEV - accepts PUT with raw file body
  app.put(
    "/api/documents/upload-proxy/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const rawId = req.params.id;

        const uploadsDir = path.resolve(process.cwd(), "local_uploads");
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // ✅ Extract extension from original filename
        const originalName = req.query.fileName
          ? String(req.query.fileName)
          : "";

        const ext = originalName ? path.extname(originalName) : "";
        const finalFileName = `${rawId}${ext}`;

        // ✅ SAVE WITH EXTENSION
        const savePath = path.join(uploadsDir, finalFileName);

        const writeStream = fs.createWriteStream(savePath);
        req.pipe(writeStream);

        writeStream.on("finish", () => {
          console.log(`✅ File uploaded successfully: ${savePath}`);

          return res.status(200).json({
            success: true,
            fileUrl: `local-uploads/${finalFileName}`, // ✅ IMPORTANT
            fileName: originalName || finalFileName,
          });
        });

        writeStream.on("error", (err) => {
          console.error("❌ Error writing upload-proxy file:", err);
          if (!res.headersSent) {
            res.status(500).json({ message: "Failed to save uploaded file" });
          }
        });

        req.on("error", (err) => {
          console.error("❌ Request error during upload:", err);
          if (!res.headersSent) {
            res.status(400).json({ message: "Upload request failed" });
          }
        });
      } catch (error) {
        console.error("❌ Error in upload-proxy:", error);
        if (!res.headersSent) {
          res.status(500).json({ message: "Upload proxy failed" });
        }
      }
    }
  );

  app.use(
    "/local-uploads",
    isAuthenticated,
    express.static(path.resolve(process.cwd(), "local_uploads"))
  );

  app.get(
    "/api/documents/upload-proxy/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const id = req.params.id;

        const uploadsDir = path.resolve(process.cwd(), "local_uploads");
        const filePath = path.join(uploadsDir, id);

        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ message: "File not found" });
        }

        const stat = fs.statSync(filePath);
        const mimeType = req.query.mimeType ? String(req.query.mimeType) : "application/octet-stream";
        res.set({
          "Content-Type": mimeType,
          "Content-Length": stat.size,
          "Content-Disposition": "inline",
          "Cache-Control": "private, max-age=3600",
        });

        const stream = fs.createReadStream(filePath);
        stream.on("error", (err) => {
          console.error("Stream error (upload-proxy GET):", err);
          if (!res.headersSent) {
            res.status(500).json({ message: "Failed to read file" });
          }
        });
        stream.pipe(res);
      } catch (error) {
        console.error("Error in upload-proxy GET:", error);
        if (!res.headersSent) {
          res.status(500).json({ message: "Failed to load uploaded file" });
        }
      }
    }
  );

  app.get("/api/documents", isAuthenticated, async (req, res) => {
    try {
      const { entityType, entityId } = req.query;
      const documents = await storage.getDocuments(
        entityType as string | undefined,
        entityId as string | undefined
      );
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.post("/api/documents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      // 🔹 Log incoming request for debugging
      console.log("📝 POST /api/documents request body:", JSON.stringify(req.body, null, 2));

      const validated = insertDocumentAttachmentSchema.parse({
        ...req.body,
        uploadedBy: userId,
      });

      console.log("✅ Document validation passed");

      let normalizedUrl = validated.fileUrl;
      try {
        normalizedUrl = await objectStorageService.trySetObjectEntityAclPolicy(
          validated.fileUrl,
          {
            owner: userId,
            visibility: "private",
          }
        );
      } catch (aclError) {
        console.warn(
          "Could not set ACL policy immediately (file may not be available yet):",
          aclError
        );
        normalizedUrl =
          objectStorageService.normalizeObjectEntityPath(validated.fileUrl);
      }

      const document = await storage.createDocument({
        ...validated,
        fileUrl: normalizedUrl,
      });
      const isPpt =
        validated.mimeType === "application/vnd.ms-powerpoint" ||
        validated.mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
        validated.fileName.toLowerCase().endsWith(".ppt") ||
        validated.fileName.toLowerCase().endsWith(".pptx");

      if (isPpt) {
        // TODO: convert and store preview
        // Implement PPT to PDF conversion and update preview URL when ready
      }

      res.status(201).json(document);
    } catch (error) {
      console.error("❌ Error creating document:", error);

      // 🔹 Log validation errors specifically
      if (error instanceof z.ZodError) {
        console.error("❌ Validation errors:", error.issues);
        return res.status(400).json({
          message: "Validation failed",
          errors: error.issues
        });
      }

      const msg =
        error instanceof Error ? error.message : "Failed to create document";
      return res.status(400).json({ message: msg });
    }
  });

  app.get(
    "/api/documents/:id/view",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const document = await storage.getDocument(req.params.id);

        if (!document) {
          return res.status(404).json({ message: "Document not found" });
        }

        if (
          document.fileUrl &&
          typeof document.fileUrl === "string" &&
          document.fileUrl.startsWith("local-uploads/")
        ) {
          const uploadsDir = path.resolve(process.cwd(), "local_uploads");
          const entityId = document.fileUrl.split("/").slice(1).join("/");
          const filePath = path.join(uploadsDir, entityId);
          if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: "File not found" });
          }
          const stat = fs.statSync(filePath);
          res.set({
            "Content-Type": document.mimeType || "application/pdf",
            "Content-Length": stat.size,
            "Content-Disposition": `inline; filename="${document.fileName}"`,
            "Cache-Control": "private, max-age=3600",
          });
          const stream = fs.createReadStream(filePath);
          stream.pipe(res);
          return;
        }

        let objectFile;
        let retries = 3;
        let lastError;

        while (retries > 0) {
          try {
            objectFile = await objectStorageService.getObjectEntityFile(
              document.fileUrl
            );
            break;
          } catch (err) {
            lastError = err;
            retries--;
            if (retries > 0) {
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }
        }

        if (!objectFile) {
          console.error("File not found after retries:", lastError);
          return res
            .status(404)
            .json({
              message: "File not yet available. Please try again in a moment.",
            });
        }

        const canAccess = await objectStorageService.canAccessObjectEntity({
          userId,
          objectFile,
        });

        if (!canAccess) {
          return res.status(403).json({ message: "Access denied" });
        }

        const [metadata] = await objectFile.getMetadata();

        res.set({
          "Content-Type": document.mimeType || "application/pdf",
          "Content-Length": metadata.size,
          "Content-Disposition": `inline; filename="${document.fileName}"`,
          "Cache-Control": "private, max-age=3600",
        });

        const stream = objectFile.createReadStream();
        stream.on("error", (err) => {
          console.error("Stream error:", err);
          if (!res.headersSent) {
            res.status(500).json({ error: "Error streaming file" });
          }
        });
        stream.pipe(res);
      } catch (error) {
        console.error("Error viewing document:", error);
        if (!res.headersSent) {
          res.status(500).json({ message: "Failed to view document" });
        }
      }
    }
  );

  app.get(
    "/api/documents/:id/download",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const document = await storage.getDocument(req.params.id);

        if (!document) {
          return res.status(404).json({ message: "Document not found" });
        }

        if (
          document.fileUrl &&
          typeof document.fileUrl === "string" &&
          document.fileUrl.startsWith("local-uploads/")
        ) {
          const uploadsDir = path.resolve(process.cwd(), "local_uploads");
          const entityId = document.fileUrl.split("/").slice(1).join("/");
          const filePath = path.join(uploadsDir, entityId);
          if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: "File not found" });
          }
          res.setHeader(
            "Content-Type",
            document.mimeType || "application/pdf"
          );
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${document.fileName}"`
          );
          const stream = fs.createReadStream(filePath);
          stream.pipe(res);
          return;
        }
        const objectFile = await objectStorageService.getObjectEntityFile(
          document.fileUrl
        );
        const canAccess = await objectStorageService.canAccessObjectEntity({
          userId,
          objectFile,
        });

        if (!canAccess) {
          return res.status(403).json({ message: "Access denied" });
        }

        await objectStorageService.downloadObject(objectFile, res);
      } catch (error) {
        console.error("Error downloading document:", error);
        if (!res.headersSent) {
          res.status(500).json({ message: "Failed to download document" });
        }
      }
    }
  );

  app.delete(
    "/api/documents/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const document = await storage.getDocument(req.params.id);

        if (!document) {
          return res.status(404).json({ message: "Document not found" });
        }

        const user = await storage.getUser(userId);
        if (document.uploadedBy !== userId && !isAdminLike(user?.role)) {
          return res.status(403).json({ message: "Access denied" });
        }
        await storage.deleteDocument(req.params.id);
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting document:", error);
        res.status(500).json({ message: "Failed to delete document" });
      }
    }
  );

  app.get("/api/pdf/property/:id", isAuthenticated, async (req, res) => {
    try {
      const property = await storage.getProperty(req.params.id);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      await PDFGenerator.generatePropertyBrochure(property, res);
    } catch (error) {
      console.error("Error generating property brochure:", error);
      if (!res.headersSent) {
        res
          .status(500)
          .json({ message: "Failed to generate property brochure" });
      }
    }
  });

  app.get("/api/pdf/leads", isAuthenticated, async (req, res) => {
    try {
      const leads = await storage.getLeads();
      await PDFGenerator.generateLeadsReport(leads, res);
    } catch (error) {
      console.error("Error generating leads report:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to generate leads report" });
      }
    }
  });

  app.get("/api/activity-logs", isAuthenticated, async (req: any, res) => {
    try {
      // Prefer DB role (most reliable)
      const userId = req.user?.claims?.sub;
      const dbUser = userId ? await storage.getUser(userId) : null;

      // Fallback to session/auth role if DB missing
      const sessionUser = (req.session as any)?.user;
      const rawRole = String(
        dbUser?.role ?? sessionUser?.role ?? req.user?.role ?? req.user?.userRole ?? ""
      ).trim();

      if (!isAdminLike(rawRole)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const date = String(req.query.date || "").trim();
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "Invalid date. Use YYYY-MM-DD" });
      }

      const logs = await storage.getActivityLogsByDate(date);
      res.json(logs);
    } catch (e) {
      console.error("Error fetching activity logs:", e);
      res.status(500).json({ message: "Failed to fetch activity logs" });
    }
  });


  app.get("/api/pdf/sales-summary", isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      const salesData = await storage.getSalesData();
      const topAgents = await storage.getTopAgents();

      const summaryData = {
        totalLeads: stats.totalLeads,
        activeLeads: stats.activeLeads,
        closedDeals: stats.closedDeals,
        totalProperties: stats.totalProperties,
        availableProperties: stats.availableProperties,
        monthlySales: salesData,
        topAgents: topAgents,
      };

      await PDFGenerator.generateSalesSummary(summaryData, res);
    } catch (error) {
      console.error("Error generating sales summary:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to generate sales summary" });
      }
    }
  });

  // Facebook/Instagram Webhook Routes - Commented out for future use
  // app.get('/api/webhooks/facebook', verifyFacebookWebhook);
  // app.post('/api/webhooks/facebook', processFacebookWebhook);

  // Webhook status endpoint - Commented out for future use
  // app.get('/api/webhooks/status', isAuthenticated, async (req: any, res) => {
  //   ...
  // });

  const httpServer = createServer(app);
  return httpServer;
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor(
    (new Date().getTime() - date.getTime()) / 1000
  );

  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}
