import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

import { Plus, Phone, Mail, Building2, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { ProjectOwnerFormDialog } from "@/components/project-owner-form-dialog";
import type { ProjectOwner } from "@shared/schema";

export default function ProjectOwners() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [isOpen, setIsOpen] = useState(false);
    const [editing, setEditing] = useState<ProjectOwner | null>(null);

    const [deleteTarget, setDeleteTarget] = useState<ProjectOwner | null>(null);
    const [search, setSearch] = useState("");

    const { data: items = [], isLoading } = useQuery<ProjectOwner[]>({
        queryKey: ["/api/project-owners"],
    });

    const filteredItems = items.filter((o) => {
        const q = search.toLowerCase().trim();
        if (!q) return true;

        return (
            o.name?.toLowerCase().includes(q) ||
            o.mobileNumber?.includes(q)
        );
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/project-owners/${id}`, {
                method: "DELETE",
                credentials: "include",
            });
            if (!res.ok) {
                const msg = await res.text();
                throw new Error(msg || "Failed to delete");
            }
            return true;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/project-owners"] });
            toast({ title: "Project Owner deleted" });
            setDeleteTarget(null);
        },
        onError: (e: any) => {
            toast({
                title: "Error",
                description: e?.message || "Failed to delete",
                variant: "destructive",
            });
        },
    });

    const openCreate = () => {
        setEditing(null);
        setIsOpen(true);
    };

    const openEdit = (o: ProjectOwner) => {
        setEditing(o);
        setIsOpen(true);
    };

    const initials = (name?: string | null) => {
        const n = (name || "").trim();
        if (!n) return "PO";
        const parts = n.split(/\s+/).slice(0, 2);
        return parts.map((p) => p[0]?.toUpperCase()).join("") || "PO";
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div className="space-y-3">
                    <div>
                        <h1 className="text-2xl font-semibold">Project Owners</h1>
                        <p className="text-sm text-muted-foreground">
                            Create and manage project owner contacts.
                        </p>
                    </div>

                    {/* Search bar */}
                    <div className="relative max-w-sm">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name or mobile number"
                            className="pl-9"
                        />
                    </div>
                </div>
                <Button onClick={openCreate} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Project Owner
                </Button>
            </div>

            {isLoading ? (
                <div className="text-muted-foreground">Loading...</div>
            ) : filteredItems.length === 0 ? (
                <Card>
                    <CardContent className="py-10 text-center text-muted-foreground">
                        No project owners found. Click <b>Add Project Owner</b> to create one.
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredItems.map((o) => (
                        <Card key={o.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-5">
                                <div className="flex items-start gap-4">
                                    <Avatar className="w-14 h-14">
                                        <AvatarImage src={o.ownerPhoto || undefined} className="object-cover" />
                                        <AvatarFallback className="bg-primary text-primary-foreground">
                                            {initials(o.name)}
                                        </AvatarFallback>
                                    </Avatar>

                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-base truncate">{o.name}</div>

                                        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                                            <div className="flex items-center gap-2">
                                                <Phone className="w-4 h-4" />
                                                <span className="truncate">{o.mobileNumber}</span>
                                            </div>

                                            {o.email ? (
                                                <div className="flex items-center gap-2">
                                                    <Mail className="w-4 h-4" />
                                                    <span className="truncate">{o.email}</span>
                                                </div>
                                            ) : null}

                                            {o.companyName ? (
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="w-4 h-4" />
                                                    <span className="truncate">{o.companyName}</span>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreVertical className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => openEdit(o)}>
                                                <Pencil className="w-4 h-4 mr-2" />
                                                Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => setDeleteTarget(o)}
                                                className="text-destructive focus:text-destructive"
                                            >
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create/Edit dialog */}
            <ProjectOwnerFormDialog
                open={isOpen}
                onOpenChange={(v) => {
                    setIsOpen(v);
                    if (!v) setEditing(null);
                }}
                initialData={editing}
            />

            {/* Delete confirm dialog */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Project Owner?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete{" "}
                            <b>{deleteTarget?.name}</b>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteTarget?.id && deleteMutation.mutate(deleteTarget.id)}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}