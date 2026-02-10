import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus } from "lucide-react";

type Tower = {
    id: string;
    projectId: string;
    name?: string | null;
    completionDate?: string | null; // ✅ NEW (ISO string from API)
    createdAt?: string | null;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { credentials: "include", ...init });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed: ${res.status}`);
    }
    return res.json();
}

export default function ProjectTowersPage() {
    const { toast } = useToast();
    const qc = useQueryClient();
    const [, setLocation] = useLocation();
    const { projectId } = useParams<{ projectId: string }>();

    const { data: towers = [], isLoading } = useQuery<Tower[]>({
        queryKey: ["/api/projects", projectId, "towers"],
        queryFn: () => fetchJson<Tower[]>(`/api/projects/${projectId}/towers`),
        enabled: !!projectId,
    });

    const [createOpen, setCreateOpen] = React.useState(false);
    const [editOpen, setEditOpen] = React.useState(false);
    const [editing, setEditing] = React.useState<Tower | null>(null);

    const [name, setName] = React.useState("");
    const [completionDate, setCompletionDate] = React.useState(""); // ✅ NEW (YYYY-MM-DD)

    const resetForm = () => {
        setName("");
        setCompletionDate("");
    };

    const createMutation = useMutation({
        mutationFn: async () => {
            const payload = {
                projectId,
                name,
                completionDate: completionDate?.trim() ? completionDate : null, // ✅ optional
            };
            return fetchJson<Tower>(`/api/projects/${projectId}/towers`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "towers"] });
            toast({ title: "Tower created" });
            setCreateOpen(false);
            resetForm();
        },
        onError: (e: any) => {
            toast({
                title: "Error",
                description: e?.message || "Failed to create tower",
                variant: "destructive",
            });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async () => {
            if (!editing) throw new Error("No tower selected");
            const payload = {
                name,
                completionDate: completionDate?.trim() ? completionDate : null, // ✅ optional
            };
            return fetchJson<Tower>(`/api/project-towers/${editing.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "towers"] });
            toast({ title: "Tower updated" });
            setEditOpen(false);
            setEditing(null);
            resetForm();
        },
        onError: (e: any) => {
            toast({
                title: "Error",
                description: e?.message || "Failed to update tower",
                variant: "destructive",
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (towerId: string) => {
            await fetchJson(`/api/project-towers/${towerId}`, { method: "DELETE" });
            return true;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "towers"] });
            toast({ title: "Tower deleted" });
        },
        onError: (e: any) => {
            toast({
                title: "Error",
                description: e?.message || "Failed to delete tower",
                variant: "destructive",
            });
        },
    });

    const openEdit = (t: Tower) => {
        setEditing(t);
        setName(t.name || "");
        setCompletionDate(
            t.completionDate ? String(t.completionDate).slice(0, 10) : "" // ✅ keep YYYY-MM-DD
        );
        setEditOpen(true);
    };

    const doDelete = (t: Tower) => {
        if (!confirm(`Delete tower "${t.name || t.id}"?`)) return;
        deleteMutation.mutate(t.id);
    };

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">Project Towers</h1>
                    <p className="text-sm text-muted-foreground">
                        Add / edit / delete towers (block/wing) for this project.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setLocation("/projects")}>
                        Back
                    </Button>

                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2">
                                <Plus className="w-4 h-4" />
                                Add Tower
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create Tower</DialogTitle>
                            </DialogHeader>

                            <div className="grid gap-3">
                                <div className="grid gap-1">
                                    <Label>Name</Label>
                                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tower A" />
                                </div>
                                <div className="grid gap-1">
                                    <Label>Completion Date (optional)</Label>
                                    <Input
                                        type="date"
                                        value={completionDate}
                                        onChange={(e) => setCompletionDate(e.target.value)}
                                    />
                                </div>

                                <div className="flex gap-2 justify-end pt-2">
                                    <Button variant="outline" onClick={() => setCreateOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={() => createMutation.mutate()}
                                        disabled={!name.trim() || createMutation.isPending}
                                    >
                                        {createMutation.isPending ? "Saving..." : "Create"}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Card className="rounded-xl">
                <CardContent className="p-4">
                    {isLoading ? (
                        <div className="text-sm text-muted-foreground">Loading...</div>
                    ) : towers.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No towers found.</div>
                    ) : (
                        <div className="grid gap-3">
                            {towers.map((t) => (
                                <div
                                    key={t.id}
                                    className="flex items-start justify-between gap-3 rounded-lg border p-3 bg-background"
                                >
                                    <div className="min-w-0">
                                        <div className="font-medium truncate">{t.name || "—"}</div>
                                        <div className="text-sm text-muted-foreground">
                                            {t.completionDate ? `Completion: ${String(t.completionDate).slice(0, 10)}` : "Completion: —"}
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                                            <Pencil className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => doDelete(t)}
                                            className="text-destructive"
                                            disabled={deleteMutation.isPending}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Tower</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-3">
                        <div className="grid gap-1">
                            <Label>Name</Label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} />
                        </div>
                        <div className="grid gap-1">
                            <Label>Completion Date (optional)</Label>
                            <Input
                                type="date"
                                value={completionDate}
                                onChange={(e) => setCompletionDate(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-2 justify-end pt-2">
                            <Button variant="outline" onClick={() => setEditOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={() => updateMutation.mutate()}
                                disabled={!name.trim() || updateMutation.isPending}
                            >
                                {updateMutation.isPending ? "Saving..." : "Update"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
