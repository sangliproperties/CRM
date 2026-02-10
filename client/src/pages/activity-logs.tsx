import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

type ActivityLog = {
    id: string;
    // ✅ user info (from joined users table)
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    userId: string | null;
    userRole: string | null;
    action: string;
    method: string;
    path: string;
    entityType?: string | null;
    entityId?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    createdAt: string;
};

function todayISO() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
}


function readableAction(log: any) {
    const method = (log.method || "").toUpperCase();
    const path = String(log.path || "");

    // Dashboard
    if (path.startsWith("/api/dashboard/stats")) return "Viewed dashboard stats";
    if (path.startsWith("/api/dashboard/recent-activities")) return "Viewed recent activities";
    if (path.startsWith("/api/dashboard/top-agents")) return "Viewed top agents";
    if (path.startsWith("/api/dashboard/daily-activities")) return "Viewed daily activity report";

    // Leads
    if (path === "/api/leads" && method === "GET") return "Viewed leads list";
    if (path === "/api/leads" && method === "POST") return "Created a lead";
    if (path.startsWith("/api/leads/") && method === "PATCH") return "Updated a lead";
    if (path.startsWith("/api/leads/") && method === "DELETE") return "Deleted a lead";
    if (path.endsWith("/activities") && method === "GET") return "Viewed lead activities";

    // Properties
    if (path === "/api/properties" && method === "GET") return "Viewed properties list";
    if (path === "/api/properties" && method === "POST") return "Created a property";
    if (path.startsWith("/api/properties/") && method === "PATCH") return "Updated a property";
    if (path.startsWith("/api/properties/") && method === "DELETE") return "Deleted a property";

    // Owners / Clients
    if (path === "/api/owners" && method === "GET") return "Viewed owners list";
    if (path === "/api/clients" && method === "GET") return "Viewed clients list";

    // Fallback
    return `${method} ${path}`;
}

function formatLocalTime(dateValue: string) {
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return "-";

    // ✅ Local time (India). Works correctly on all PCs.
    return d.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true, // change to false if you want 24-hour
    });
}

export default function ActivityLogs() {
    const [date, setDate] = useState<string>(todayISO());

    const queryKey = useMemo(() => [`activity-logs?date=${date}`], [date]);

    const { data, isLoading, error } = useQuery<ActivityLog[]>({
        queryKey,
        queryFn: getQueryFn<ActivityLog[]>({ on401: "throw" }),
        enabled: !!date,
    });

    return (
        <div className="p-6 space-y-4">
            <Card className="hover-elevate">
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <CardTitle className="text-lg font-semibold">Activity Logs</CardTitle>

                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Date</span>
                        <Input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-[170px]"
                        />
                    </div>
                </CardHeader>

                <CardContent>
                    {isLoading && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading logs...
                        </div>
                    )}

                    {error && (
                        <div className="text-sm text-red-600">
                            Failed to load logs: {(error as Error).message}
                        </div>
                    )}

                    {!isLoading && !error && (!data || data.length === 0) && (
                        <div className="text-sm text-muted-foreground">
                            No activity found for {date}.
                        </div>
                    )}

                    {!isLoading && !error && data && data.length > 0 && (
                        <div className="overflow-auto border rounded-lg">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50">
                                    <tr className="text-left">
                                        <th className="p-3 whitespace-nowrap">Time</th>
                                        <th className="p-3 whitespace-nowrap">User Role</th>
                                        <th className="p-3 whitespace-nowrap">Action</th>
                                        <th className="p-3 whitespace-nowrap">Method</th>
                                        <th className="p-3">Path</th>
                                        <th className="p-3 whitespace-nowrap">IP</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map((log) => {
                                        const time = formatLocalTime(log.createdAt);
                                        return (
                                            <tr
                                                key={log.id}
                                                className="border-t hover:bg-slate-50 transition-colors"
                                            >
                                                <td className="p-3 whitespace-nowrap">{time}</td>
                                                <td className="p-3 whitespace-nowrap">
                                                    {(() => {
                                                        const userName =
                                                            [log.firstName, log.lastName].filter(Boolean).join(" ") ||
                                                            log.email ||
                                                            "Unknown";

                                                        return userName;
                                                    })()}
                                                </td>
                                                <td className="p-3 whitespace-nowrap">
                                                    {readableAction(log)}
                                                </td>
                                                <td className="p-3 whitespace-nowrap">{log.method}</td>
                                                <td className="p-3 break-all">{log.path}</td>
                                                <td className="p-3 whitespace-nowrap">{log.ip || "-"}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
