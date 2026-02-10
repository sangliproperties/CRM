import { useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type Project = {
    id: string;
    projectName?: string | null;
    status?: string | null;
};

const STATUS_OPTIONS = [
    "Available",
    "Sold",
    "De Listed",
    "Under Construction",
    "On Hold",
] as const;

export default function ProjectStatusPage() {
    const [, setLocation] = useLocation();
    const [, params] = useRoute("/projects/:projectId/status");
    const projectId = params?.projectId;

    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: project, isLoading, error } = useQuery<Project>({
        queryKey: ["/api/projects", projectId],
        enabled: !!projectId,
        queryFn: async () => {
            const res = await fetch(`/api/projects/${projectId}`, {
                credentials: "include",
            });
            if (!res.ok) throw new Error("Failed to fetch project");
            return res.json();
        },
    });

    const initialStatus = useMemo(() => project?.status || "", [project?.status]);
    const [status, setStatus] = useState<string>("");

    // sync local state when project loads
    useMemo(() => {
        if (project && status === "") setStatus(project.status || "");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project]);

    const updateMutation = useMutation({
        mutationFn: async () => {
            if (!projectId) throw new Error("Missing projectId");
            const res = await fetch(`/api/projects/${projectId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ status }),
            });
            if (!res.ok) {
                const msg = await res.text();
                throw new Error(msg || "Failed to update status");
            }
            return res.json();
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
            await queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
            toast({ title: "Project status updated" });
        },
        onError: (e: any) => {
            toast({
                title: "Error",
                description: e?.message || "Failed to update project status",
                variant: "destructive",
            });
        },
    });

    if (!projectId) {
        return (
            <div className="p-6">
                <div className="text-sm text-muted-foreground">Invalid project id.</div>
                <Button variant="outline" className="mt-3" onClick={() => setLocation("/projects")}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Projects
                </Button>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setLocation("/projects")}
                            aria-label="Back"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                        <h1 className="text-2xl font-semibold">Project Status</h1>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                        Update status for your project.
                    </p>
                </div>
            </div>

            <div className="mt-5">
                {isLoading ? (
                    <div className="text-sm text-muted-foreground">Loading...</div>
                ) : error ? (
                    <div className="text-sm text-destructive">Failed to load project.</div>
                ) : (
                    <Card className="rounded-xl">
                        <CardContent className="p-5">
                            <div className="flex flex-col gap-4">
                                <div>
                                    <div className="text-sm text-muted-foreground">Project</div>
                                    <div className="font-semibold">{project?.projectName || "-"}</div>
                                </div>

                                <div>
                                    <div className="text-sm text-muted-foreground mb-2">Select Status</div>

                                    {/* Simple select without extra UI dependencies */}
                                    <select
                                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                    >
                                        <option value="">-- Select --</option>
                                        {STATUS_OPTIONS.map((s) => (
                                            <option key={s} value={s}>
                                                {s}
                                            </option>
                                        ))}
                                        {/* Allow custom status if backend already has one not in list */}
                                        {status &&
                                            !STATUS_OPTIONS.includes(status as any) && (
                                                <option value={status}>{status}</option>
                                            )}
                                    </select>

                                    <div className="text-xs text-muted-foreground mt-2">
                                        Current: <span className="font-medium">{initialStatus || "-"}</span>
                                    </div>
                                </div>

                                <div className="flex gap-2 justify-end">
                                    <Button
                                        variant="outline"
                                        onClick={() => setLocation("/projects")}
                                        disabled={updateMutation.isPending}
                                    >
                                        Cancel
                                    </Button>

                                    <Button
                                        onClick={() => updateMutation.mutate()}
                                        disabled={updateMutation.isPending || !status}
                                        className="gap-2"
                                    >
                                        <Save className="w-4 h-4" />
                                        Save
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
