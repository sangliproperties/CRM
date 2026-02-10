import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreVertical, Plus, Trash2, Pencil } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

import type { ProjectWithOwner } from "@shared/schema";
import { ProjectFormDialog } from "@/components/project-form-dialog";

export default function Projects() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [openForm, setOpenForm] = useState(false);
    const [editing, setEditing] = useState<ProjectWithOwner | null>(null);
    const [, setLocation] = useLocation();

    const { data: items = [], isLoading } = useQuery<ProjectWithOwner[]>({
        queryKey: ["/api/projects"],
        queryFn: async () => {
            const res = await fetch("/api/projects", { credentials: "include" });
            if (!res.ok) throw new Error("Failed to fetch projects");
            return res.json();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/projects/${id}`, {
                method: "DELETE",
                credentials: "include",
            });
            if (!res.ok) {
                const msg = await res.text();
                throw new Error(msg || "Failed to delete project");
            }
            return true;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
            toast({ title: "Project deleted" });
        },
        onError: (e: any) => {
            toast({
                title: "Error",
                description: e?.message || "Failed to delete project",
                variant: "destructive",
            });
        },
    });

    const onAdd = () => {
        setEditing(null);
        setOpenForm(true);
    };

    const onEdit = (p: ProjectWithOwner) => {
        setEditing(p);
        setOpenForm(true);
    };

    const onDelete = (p: ProjectWithOwner) => {
        if (!confirm(`Delete project "${p.projectName}"?`)) return;
        deleteMutation.mutate(p.id);
    };

    const cards = useMemo(() => items, [items]);

    return (
        <div className="p-6">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">Projects</h1>
                    <p className="text-muted-foreground text-sm">Create and manage projects.</p>
                </div>

                <Button onClick={onAdd} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Project
                </Button>
            </div>

            <div className="mt-5">
                {isLoading ? (
                    <div className="text-sm text-muted-foreground">Loading...</div>
                ) : cards.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No projects found.</div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {cards.map((p) => (
                            <Card key={p.id} className="rounded-xl">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="font-semibold truncate">{p.projectName}</div>
                                            <div className="text-sm text-muted-foreground truncate">
                                                Owner: {p.projectOwnerName || "-"}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {/* ✅ ACTION MENU */}
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" size="sm">Action</Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => setLocation(`/projects/${p.id}/status`)}>
                                                        Project Status
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => setLocation(`/projects/${p.id}/towers`)}>
                                                        Add Tower/Block/Wing
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => setLocation(`/projects/${p.id}/units`)}>
                                                        Add Unit/Plan Configuration
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => setLocation(`/projects/${p.id}/images`)}>
                                                        Project Images
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => setLocation(`/projects/${p.id}/documents`)}>
                                                        Attach Documents
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>

                                            {/* ✅ EXISTING EDIT/DELETE MENU */}
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreVertical className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => onEdit(p)} className="gap-2">
                                                        <Pencil className="w-4 h-4" />
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => onDelete(p)}
                                                        className="gap-2 text-destructive focus:text-destructive"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>

                                    <div className="mt-3 grid gap-1 text-sm">
                                        <div className="flex gap-2">
                                            <span className="text-muted-foreground">Project Area:</span>
                                            <span className="truncate">{p.projectArea || "-"}</span>
                                        </div>

                                        <div className="flex gap-2">
                                            <span className="text-muted-foreground">Transaction:</span>
                                            <span className="truncate">{p.transactionType || "-"}</span>
                                        </div>

                                        <div className="flex gap-2">
                                            <span className="text-muted-foreground">Address:</span>
                                            <span className="truncate">{p.projectAddress || "-"}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <ProjectFormDialog
                open={openForm}
                onOpenChange={setOpenForm}
                initialData={editing}
            />
        </div>
    );
}
