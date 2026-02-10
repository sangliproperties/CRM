import fs from "fs";
import path from "path";

function toSafeFilePart(input: string) {
    return String(input || "")
        .trim()
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .slice(0, 60);
}

// Same readable-action mapping you already use in:
// client/src/pages/activity-logs.tsx
function readableActionFrom(methodRaw: string, pathRaw: string) {
    const method = (methodRaw || "").toUpperCase();
    const p = String(pathRaw || "");

    // Dashboard
    if (p.startsWith("/api/dashboard/stats")) return "Viewed dashboard stats";
    if (p.startsWith("/api/dashboard/recent-activities")) return "Viewed recent activities";
    if (p.startsWith("/api/dashboard/top-agents")) return "Viewed top agents";
    if (p.startsWith("/api/dashboard/daily-activities")) return "Viewed daily activity report";

    // Leads
    if (p === "/api/leads" && method === "GET") return "Viewed leads list";
    if (p === "/api/leads" && method === "POST") return "Created a lead";
    if (p.startsWith("/api/leads/") && method === "PATCH") return "Updated a lead";
    if (p.startsWith("/api/leads/") && method === "DELETE") return "Deleted a lead";
    if (p.endsWith("/activities") && method === "GET") return "Viewed lead activities";

    // Properties
    if (p === "/api/properties" && method === "GET") return "Viewed properties list";
    if (p === "/api/properties" && method === "POST") return "Created a property";
    if (p.startsWith("/api/properties/") && method === "PATCH") return "Updated a property";
    if (p.startsWith("/api/properties/") && method === "DELETE") return "Deleted a property";

    // Owners / Clients
    if (p === "/api/owners" && method === "GET") return "Viewed owners list";
    if (p === "/api/clients" && method === "GET") return "Viewed clients list";

    // Dashboard (missing in your file)
    if (p.startsWith("/api/dashboard/sales")) return "Viewed sales dashboard";
    if (p.startsWith("/api/dashboard/expiring-agreements")) return "Viewed expiring agreements";
    if (p.startsWith("/api/dashboard/lead-sources")) return "Viewed lead sources";

    // Reports
    if (p === "/api/reports/summary" && method === "GET") return "Viewed reports summary";
    if (p === "/api/reports/export/properties" && method === "GET") return "Exported properties report";

    if (p === "/api/reports/export/sales" && method === "GET") return "Exported sales report";
    if (p === "/api/reports/export/leads" && method === "GET") return "Exported leads report";
    // Documents
    if (p === "/api/documents" && method === "POST") return "Uploaded a document";
    if (p === "/api/documents/upload-url" && method === "GET") return "Requested document upload URL";
    if (p.startsWith("/api/documents/upload-proxy/") && method === "PUT") return "Uploaded document file (proxy upload)";
    if (p.startsWith("/api/documents/") && method === "DELETE") return "Deleted a document";

    // PDF Exports
    if (p.startsWith("/api/pdf/") && method === "GET") {
        const type = p.split("/").pop() || "pdf";
        return `Downloaded PDF: ${type}`;
    }

    // Activity logs page/API
    if (p.startsWith("/api/activity-logs") && method === "GET") return "Viewed activity logs";

    // Users
    if (p === "/api/users/agents" && method === "GET") return "Viewed agents list";

    // Documents (property documents fetch)
    if (p === "/api/documents" && method === "GET") return "Viewed documents";

    // Property images loader (very noisy, but make it readable)
    if (p === "/api/properties/images" && method === "GET") return "Loaded property images";

    // Login
    if (p === "/api/login" && method === "GET") return "Opened login page";

    return `${method} ${p}`;
}

export function appendActivityTxtLog(params: {
    time: Date;
    userRole: string;
    userName: string;
    method: string;
    path: string;
    ip: string;
}) {
    const dateStr = params.time.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    const safeUser = toSafeFilePart(params.userName) || "UnknownUser";

    // Project root logs folder:
    // SangliCRM_Live/logs/activity-logs/
    const logsDir = path.join(process.cwd(), "logs", "activity-logs");
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

    const fileName = `${safeUser}_${dateStr}.txt`;
    const filePath = path.join(logsDir, fileName);

    const header =
        "Time\tUser Role\tUser Name\tReadable Action\tMethod\tPath\tIP\n";

    // ✅ Normalize path: remove query string so mapping works for /api/properties?page=...
    const normalizedPath = String(params.path || "").split("?")[0];

    const readable = readableActionFrom(params.method, normalizedPath);

    const timeStr = params.time.toISOString().replace("T", " ").slice(0, 19);

    const line =
        `${timeStr}\t${params.userRole}\t${params.userName}\t${readable}\t${params.method}\t${params.path}\t${params.ip}\n`;

    // Write header only once (when file is new)
    if (!fs.existsSync(filePath)) {
        fs.appendFileSync(filePath, header, { encoding: "utf-8" });
    }

    fs.appendFileSync(filePath, line, { encoding: "utf-8" });
}
