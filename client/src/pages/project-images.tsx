import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Star, Eye, Download } from "lucide-react";

type ProjectImage = {
    id: string;
    projectId: string;
    imageUrl: string;
    title?: string | null;
    isDefault?: boolean | null;
    createdAt?: string | null;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { credentials: "include", ...init });

    const text = await res.text().catch(() => "");

    if (!res.ok) {
        throw new Error(text || `Request failed: ${res.status}`);
    }

    // ✅ handle 204 / empty body
    if (!text) return undefined as unknown as T;

    try {
        return JSON.parse(text) as T;
    } catch {
        // if backend ever returns plain text
        return text as unknown as T;
    }
}

function isAbsoluteUrl(u: string) {
    return /^https?:\/\//i.test(u);
}

function normalizeFileUrl(u?: string | null) {
    if (!u) return "";
    // if stored as "local-uploads/abc", make it "/local-uploads/abc"
    if (u.startsWith("local-uploads/")) return `/${u}`;
    return u;
}

export default function ProjectImagesPage() {
    const { toast } = useToast();
    const qc = useQueryClient();
    const [, setLocation] = useLocation();
    const { projectId } = useParams<{ projectId: string }>();

    const { data: images = [], isLoading } = useQuery<ProjectImage[]>({
        queryKey: ["/api/projects", projectId, "images"],
        queryFn: () => fetchJson<ProjectImage[]>(`/api/projects/${projectId}/images`),
        enabled: !!projectId,
    });

    const [open, setOpen] = React.useState(false);
    const [files, setFiles] = React.useState<File[]>([]);

    const resetForm = () => setFiles([]);

    // ✅ Upload via existing /api/documents/upload-url + PUT upload + create project-image records
    const uploadMutation = useMutation({
        mutationFn: async () => {
            if (!projectId) throw new Error("Missing projectId");
            if (files.length === 0) return [];

            const created: ProjectImage[] = [];

            for (const f of files) {
                // 1) Get upload URL + file URL (uses your existing backend route)
                const { uploadUrl, fileUrl } = await fetchJson<{
                    uploadUrl: string;
                    fileUrl: string;
                }>(
                    `/api/documents/upload-url?fileName=${encodeURIComponent(
                        f.name
                    )}&mimeType=${encodeURIComponent(f.type || "application/octet-stream")}`
                );

                // 2) PUT file to uploadUrl (absolute presigned OR local proxy)
                const putRes = await fetch(uploadUrl, {
                    method: "PUT",
                    body: f,
                    headers: {
                        "Content-Type": f.type || "application/octet-stream",
                    },
                    // IMPORTANT:
                    // - if uploadUrl is local (starts with /api/...), include cookies
                    // - if presigned absolute URL, credentials must be omitted
                    ...(isAbsoluteUrl(uploadUrl) ? {} : { credentials: "include" as RequestCredentials }),
                });

                if (!putRes.ok) {
                    const t = await putRes.text().catch(() => "");
                    throw new Error(t || `Upload failed for ${f.name}: ${putRes.status}`);
                }

                // 3) Create project image record (uses your existing POST route)
                const img = await fetchJson<ProjectImage>(
                    `/api/projects/${projectId}/images`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            projectId,
                            imageUrl: fileUrl,
                            title: null, // optional (you can set: f.name if you want)
                        }),
                    }
                );

                created.push(img);
            }

            return created;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "images"] });
            toast({ title: "Images uploaded" });
            setOpen(false);
            resetForm();
        },
        onError: (e: any) => {
            toast({
                title: "Error",
                description: e?.message || "Failed to upload images",
                variant: "destructive",
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (imageId: string) => {
            await fetchJson(`/api/project-images/${imageId}`, { method: "DELETE" });
            return true;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "images"] });
            toast({ title: "Image deleted" });
        },
        onError: (e: any) => {
            toast({
                title: "Error",
                description: e?.message || "Failed to delete image",
                variant: "destructive",
            });
        },
    });

    const setDefaultMutation = useMutation({
        mutationFn: async (imageId: string) => {
            return fetchJson(`/api/projects/${projectId}/images/${imageId}/default`, {
                method: "PATCH",
            });
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "images"] });
            toast({ title: "Default image updated" });
        },
        onError: (e: any) => {
            toast({
                title: "Error",
                description: e?.message || "Failed to set default image",
                variant: "destructive",
            });
        },
    });

    const doDelete = (img: ProjectImage) => {
        if (!confirm("Delete this image?")) return;
        deleteMutation.mutate(img.id);
    };

    const doView = (img: ProjectImage) => {
        // Open backend streaming route directly
        window.open(
            `/api/project-images/${img.id}/view`,
            "_blank",
            "noopener,noreferrer"
        );
    };

    const doDownload = async (img: ProjectImage) => {
        try {
            const res = await fetch(img.imageUrl, { credentials: "include" as any });
            if (!res.ok) throw new Error("Download failed");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = `project-image-${img.id}`;
            document.body.appendChild(a);
            a.click();
            a.remove();

            URL.revokeObjectURL(url);
        } catch {
            window.open(img.imageUrl, "_blank", "noopener,noreferrer");
        }
    };

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">Project Images</h1>
                    <p className="text-sm text-muted-foreground">
                        Upload images and choose a default image.
                    </p>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setLocation("/projects")}>
                        Back
                    </Button>

                    <Dialog
                        open={open}
                        onOpenChange={(v) => {
                            setOpen(v);
                            if (!v) resetForm();
                        }}
                    >
                        <DialogTrigger asChild>
                            <Button className="gap-2">
                                <Plus className="w-4 h-4" />
                                Upload Images
                            </Button>
                        </DialogTrigger>

                        {/* ✅ Fix "cannot scroll" inside dialog */}
                        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Upload Project Images</DialogTitle>
                            </DialogHeader>

                            <div className="grid gap-3">
                                <div className="grid gap-1">
                                    <Label>Upload Images (optional)</Label>
                                    <Input
                                        type="file"
                                        multiple
                                        accept="image/*"
                                        onChange={(e) => {
                                            const list = e.target.files ? Array.from(e.target.files) : [];
                                            setFiles(list);
                                        }}
                                    />
                                    {files.length ? (
                                        <div className="text-xs text-muted-foreground">
                                            Selected: {files.length} file{files.length > 1 ? "s" : ""}
                                        </div>
                                    ) : (
                                        <div className="text-xs text-muted-foreground">
                                            No files selected.
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                    <Button variant="outline" onClick={() => setOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={() => uploadMutation.mutate()}
                                        disabled={files.length === 0 || uploadMutation.isPending}
                                    >
                                        {uploadMutation.isPending ? "Uploading..." : "Upload"}
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
                    ) : images.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No images found.</div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {images.map((img) => (
                                <div
                                    key={img.id}
                                    className="rounded-xl border bg-background overflow-hidden"
                                >
                                    <div className="aspect-video bg-muted">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={normalizeFileUrl(img.imageUrl)}
                                            alt={img.title || "Project image"}
                                            className="h-full w-full object-cover"
                                            onError={(e) => {
                                                (e.currentTarget as HTMLImageElement).style.display = "none";
                                            }}
                                        />
                                    </div>

                                    <div className="p-3 space-y-2">
                                        <div className="font-medium truncate">
                                            {img.isDefault ? "Default Image" : "Project Image"}
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="gap-2"
                                                onClick={() => doView(img)}
                                            >
                                                <Eye className="w-4 h-4" />
                                                View
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="gap-2"
                                                onClick={() => window.open(`/api/project-images/${img.id}/download`, "_blank", "noopener,noreferrer")}
                                            >
                                                <Download className="w-4 h-4" />
                                                Download
                                            </Button>


                                            <Button
                                                variant={img.isDefault ? "default" : "outline"}
                                                size="sm"
                                                className="gap-2"
                                                onClick={() => setDefaultMutation.mutate(img.id)}
                                                disabled={setDefaultMutation.isPending}
                                            >
                                                <Star className="w-4 h-4" />
                                                {img.isDefault ? "Default" : "Set Default"}
                                            </Button>

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive"
                                                onClick={() => doDelete(img)}
                                                disabled={deleteMutation.isPending}
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
