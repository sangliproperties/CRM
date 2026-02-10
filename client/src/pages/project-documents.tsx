import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Download, ExternalLink } from "lucide-react";

type ProjectDocument = {
    id: string;
    projectId: string;
    // "Name" you want (backend should store this; could be title/name/label etc.)
    name?: string | null;

    // Stored file info
    fileUrl: string;
    fileName?: string | null;
    mimeType?: string | null;
    createdAt?: string | null;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { credentials: "include", ...init });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed: ${res.status}`);
    }

    // ✅ handle 204 / empty body safely
    if (res.status === 204) return undefined as T;

    const text = await res.text().catch(() => "");
    if (!text) return undefined as T;

    return JSON.parse(text) as T;
}

export default function ProjectDocumentsPage() {
    const { toast } = useToast();
    const qc = useQueryClient();
    const [, setLocation] = useLocation();
    const { projectId } = useParams<{ projectId: string }>();

    const { data: docs = [], isLoading } = useQuery<ProjectDocument[]>({
        queryKey: ["/api/projects", projectId, "documents"],
        queryFn: () => fetchJson<ProjectDocument[]>(`/api/projects/${projectId}/documents`),
        enabled: !!projectId,
    });

    // Upload dialog state
    const [open, setOpen] = React.useState(false);
    const [name, setName] = React.useState("");
    const [files, setFiles] = React.useState<FileList | null>(null);

    const resetForm = () => {
        setName("");
        setFiles(null);
    };

    const uploadMutation = useMutation({
        mutationFn: async () => {
            if (!projectId) throw new Error("Missing projectId");
            if (!name.trim()) throw new Error("Name is required");
            if (!files || files.length === 0) throw new Error("Please choose at least one file");

            const uploaded: any[] = [];

            for (const file of Array.from(files)) {
                // 1) get upload url
                const q = new URLSearchParams({
                    fileName: file.name,
                    mimeType: file.type || "application/octet-stream",
                });
                const { uploadUrl, fileUrl } = await fetchJson<{ uploadUrl: string; fileUrl: string }>(
                    `/api/documents/upload-url?${q.toString()}`
                );

                // 2) PUT file to uploadUrl
                const putRes = await fetch(uploadUrl, {
                    method: "PUT",
                    body: file,
                    headers: { "Content-Type": file.type || "application/octet-stream" },
                    credentials: "include",
                });
                if (!putRes.ok) {
                    const t = await putRes.text().catch(() => "");
                    throw new Error(t || `Upload failed: ${putRes.status}`);
                }

                // 3) create project document record (existing route in routes.ts)
                const created = await fetchJson<ProjectDocument>(`/api/projects/${projectId}/documents`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                        projectId,
                        name: name.trim(),

                        fileUrl, // from upload-url response

                        // keep one of these as "type"
                        fileType: file.name.split(".").pop() || "",

                        // ✅ ADD THESE TWO:
                        fileName: file.name,
                        mimeType: file.type || "application/octet-stream",
                    }),
                });

                uploaded.push(created);
            }

            return uploaded;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "documents"] });
            toast({ title: "Documents uploaded" });
            setOpen(false);
            resetForm();
        },
        onError: (e: any) => {
            toast({
                title: "Error",
                description: e?.message || "Failed to upload documents",
                variant: "destructive",
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (docId: string) => {
            await fetchJson(`/api/project-documents/${docId}`, { method: "DELETE" });
            return true;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "documents"] });
            toast({ title: "Document deleted" });
        },
        onError: (e: any) => {
            toast({
                title: "Error",
                description: e?.message || "Failed to delete document",
                variant: "destructive",
            });
        },
    });

    const doDelete = (d: ProjectDocument) => {
        const label = d.name || d.fileName || d.id;
        if (!confirm(`Delete document "${label}"?`)) return;
        deleteMutation.mutate(d.id);
    };

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">Project Documents</h1>
                    <p className="text-sm text-muted-foreground">
                        Upload and manage project documents (brochures, approvals, plans, etc.).
                    </p>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setLocation("/projects")}>
                        Back
                    </Button>

                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2">
                                <Plus className="w-4 h-4" />
                                Attach Document
                            </Button>
                        </DialogTrigger>

                        <DialogContent className="max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Attach Document</DialogTitle>
                            </DialogHeader>

                            <div className="grid gap-3">
                                <div className="grid gap-1">
                                    <Label>Name</Label>
                                    <Input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Brochure / Floor Plan"
                                    />
                                </div>

                                <div className="grid gap-1">
                                    <Label>Choose File (optional)</Label>
                                    <Input
                                        type="file"
                                        multiple
                                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                                        onChange={(e) => setFiles(e.target.files)}
                                    />
                                    {files && files.length > 0 ? (
                                        <div className="text-xs text-muted-foreground">
                                            Selected: {Array.from(files).map((f) => f.name).join(", ")}
                                        </div>
                                    ) : null}
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setOpen(false);
                                            resetForm();
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={() => uploadMutation.mutate()}
                                        disabled={!name.trim() || !files || files.length === 0 || uploadMutation.isPending}
                                    >
                                        {uploadMutation.isPending ? "Uploading..." : "Upload"}
                                    </Button>
                                </div>

                                <div className="text-xs text-muted-foreground">
                                    Note: This requires a backend upload endpoint that accepts <b>multipart/form-data</b>.
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
                    ) : docs.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No documents found.</div>
                    ) : (
                        <div className="grid gap-3">
                            {docs.map((d) => {
                                const href =
                                    d.fileUrl?.startsWith("http")
                                        ? d.fileUrl
                                        : d.fileUrl?.startsWith("/")
                                            ? d.fileUrl
                                            : `/${d.fileUrl}`;

                                const isPdf =
                                    (d.mimeType || "").toLowerCase() === "application/pdf" ||
                                    (d.fileName || "").toLowerCase().endsWith(".pdf");

                                const viewUrl = `/api/project-documents/${d.id}/view`;
                                const downloadUrl = `/api/project-documents/${d.id}/download`;

                                return (
                                    <div
                                        key={d.id}
                                        className="flex items-start justify-between gap-3 rounded-lg border p-3 bg-background"
                                    >
                                        <div className="min-w-0 space-y-1">
                                            <div className="font-medium truncate">
                                                {d.name || d.fileName || "Untitled"}
                                            </div>
                                            <div className="text-xs text-muted-foreground truncate">
                                                {d.fileName ? `File: ${d.fileName}` : null}
                                                {d.mimeType ? (d.fileName ? " • " : "") + d.mimeType : null}
                                            </div>

                                            <div className="flex gap-3">
                                                {isPdf ? (
                                                    <a
                                                        href={viewUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-sm underline text-primary inline-flex items-center gap-1"
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                        View
                                                    </a>
                                                ) : null}

                                                <a
                                                    href={downloadUrl}
                                                    className="text-sm underline text-primary inline-flex items-center gap-1"
                                                >
                                                    <Download className="w-4 h-4" />
                                                    Download
                                                </a>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => doDelete(d)}
                                                className="text-destructive"
                                                disabled={deleteMutation.isPending}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
