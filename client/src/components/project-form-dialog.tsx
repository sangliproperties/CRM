import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Check, ChevronsUpDown, Upload } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

import type { InsertProject, ProjectOwner, ProjectWithOwner } from "@shared/schema";
import { insertProjectSchema } from "@shared/schema";

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialData?: ProjectWithOwner | null;
};

const formSchema = insertProjectSchema;

export function ProjectFormDialog({ open, onOpenChange, initialData }: Props) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const isEdit = !!initialData?.id;

    const { data: projectOwners = [] } = useQuery<ProjectOwner[]>({
        queryKey: ["/api/project-owners"],
        queryFn: async () => {
            const res = await fetch("/api/project-owners", { credentials: "include" });
            if (!res.ok) throw new Error("Failed to fetch project owners");
            return res.json();
        },
        enabled: open,
    });

    const emptyForm: InsertProject = useMemo(
        () => ({
            projectOwnerId: "",
            launchDate: null,
            completionDate: null,
            projectName: "",
            reraNo: "",
            projectArea: "",
            possession: "",
            possessionDate: null,
            transactionType: "",
            description: "",
            specification: "",
            amenities: "",
            youtubeVideoUrl: "",
            virtualVideo: "",
            projectAddress: "",
        }),
        []
    );

    const [form, setForm] = useState<InsertProject>(emptyForm);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [ownerOpen, setOwnerOpen] = useState(false);

    useEffect(() => {
        if (!open) return;

        if (initialData) {
            setForm({
                projectOwnerId: initialData.projectOwnerId ?? "",
                launchDate: initialData.launchDate ? new Date(initialData.launchDate) : null,
                completionDate: initialData.completionDate ? new Date(initialData.completionDate) : null,
                projectName: initialData.projectName ?? "",
                reraNo: (initialData as any).reraNo ?? "",
                projectArea: initialData.projectArea ?? "",
                possession: initialData.possession ?? "",
                possessionDate: initialData.possessionDate ? new Date(initialData.possessionDate) : null,
                transactionType: initialData.transactionType ?? "",
                description: initialData.description ?? "",
                specification: initialData.specification ?? "",
                amenities: initialData.amenities ?? "",
                youtubeVideoUrl: initialData.youtubeVideoUrl ?? "",
                virtualVideo: initialData.virtualVideo ?? "",
                projectAddress: initialData.projectAddress ?? "",
            });
        } else {
            setForm(emptyForm);
        }

        setErrors({});
    }, [open, initialData, emptyForm]);

    const mutation = useMutation({
        mutationFn: async (payload: InsertProject) => {
            const url = isEdit ? `/api/projects/${initialData!.id}` : "/api/projects";
            const method = isEdit ? "PATCH" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                credentials: "include",
            });

            if (!res.ok) {
                const msg = await res.text();
                throw new Error(msg || "Request failed");
            }

            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
            toast({ title: isEdit ? "Project updated" : "Project created" });
            onOpenChange(false);
        },
        onError: (e: any) => {
            toast({
                title: "Error",
                description: e?.message || "Something went wrong",
                variant: "destructive",
            });
        },
    });

    const setField = (key: keyof InsertProject, value: any) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const validate = () => {
        try {
            formSchema.parse(form);

            // extra rule: if possession is Specify Time, possessionDate should exist
            if (form.possession === "Specify Time" && !form.possessionDate) {
                setErrors((prev) => ({ ...prev, possessionDate: "Possession Date is required" }));
                return false;
            }

            setErrors({});
            return true;
        } catch (err) {
            if (err instanceof z.ZodError) {
                const next: Record<string, string> = {};
                for (const issue of err.issues) {
                    const path = issue.path?.[0];
                    if (typeof path === "string") next[path] = issue.message;
                }
                setErrors(next);
            }
            return false;
        }
    };

    const onSubmit = () => {
        if (!validate()) return;

        const payload: InsertProject = {
            ...form,
            projectOwnerId: form.projectOwnerId.trim(),
            projectName: form.projectName.trim(),

            reraNo: form.reraNo?.trim() || "",
            projectArea: form.projectArea?.trim() || "",
            possession: form.possession?.trim() || "",
            transactionType: form.transactionType?.trim() || "",
            description: form.description?.trim() || "",
            specification: form.specification?.trim() || "",
            amenities: form.amenities?.trim() || "",
            youtubeVideoUrl: form.youtubeVideoUrl?.trim() || "",
            projectAddress: form.projectAddress?.trim() || "",

            launchDate: form.launchDate ? new Date(form.launchDate) : null,
            completionDate: form.completionDate ? new Date(form.completionDate) : null,
            possessionDate: form.possessionDate ? new Date(form.possessionDate) : null,
        };

        mutation.mutate(payload);
    };

    const ownerSelected = projectOwners.find((o) => o.id === form.projectOwnerId);
    const launchValue = form.launchDate ? new Date(form.launchDate).toISOString().slice(0, 10) : "";
    const completionValue = form.completionDate ? new Date(form.completionDate).toISOString().slice(0, 10) : "";
    const possessionDateValue = form.possessionDate ? new Date(form.possessionDate).toISOString().slice(0, 10) : "";

    const possessionIsSpecify = form.possession === "Specify Time";

    const handleVirtualVideoPick = (file?: File | null) => {
        if (!file) {
            setField("virtualVideo", "");
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const result = typeof reader.result === "string" ? reader.result : "";
            setField("virtualVideo", result);
        };
        reader.readAsDataURL(file);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit Project" : "Add Project"}</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4">
                    {/* Project Owner combobox */}
                    <div className="grid gap-2">
                        <Label>Project Owner *</Label>
                        <Popover open={ownerOpen} onOpenChange={setOwnerOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    className="justify-between"
                                    data-testid="project-owner-combobox"
                                >
                                    <span className="truncate">
                                        {ownerSelected ? `${ownerSelected.name} (${ownerSelected.mobileNumber})` : "Select project owner"}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>

                            <PopoverContent className="p-0" align="start">
                                <Command>
                                    <CommandInput placeholder="Search by name or mobile..." />
                                    <CommandEmpty>No project owner found.</CommandEmpty>
                                    <CommandGroup>
                                        {projectOwners.map((o) => (
                                            <CommandItem
                                                key={o.id}
                                                value={`${o.name} ${o.mobileNumber}`}
                                                onSelect={() => {
                                                    setField("projectOwnerId", o.id);
                                                    setOwnerOpen(false);
                                                }}
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        form.projectOwnerId === o.id ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                <div className="flex flex-col">
                                                    <span>{o.name}</span>
                                                    <span className="text-xs text-muted-foreground">{o.mobileNumber}</span>
                                                </div>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </Command>
                            </PopoverContent>
                        </Popover>

                        {errors.projectOwnerId ? (
                            <p className="text-sm text-destructive">{errors.projectOwnerId}</p>
                        ) : null}
                    </div>

                    {/* Dates */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label>Launch Date</Label>
                            <Input
                                type="date"
                                value={launchValue}
                                onChange={(e) => setField("launchDate", e.target.value ? new Date(e.target.value) : null)}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>Completion Date</Label>
                            <Input
                                type="date"
                                value={completionValue}
                                onChange={(e) => setField("completionDate", e.target.value ? new Date(e.target.value) : null)}
                            />
                        </div>
                    </div>

                    {/* Project name */}
                    <div className="grid gap-2">
                        <Label>Project Name *</Label>
                        <Input
                            value={form.projectName}
                            onChange={(e) => setField("projectName", e.target.value)}
                            placeholder="Enter project name"
                        />
                        {errors.projectName ? <p className="text-sm text-destructive">{errors.projectName}</p> : null}
                    </div>

                    {/* RERA + Area */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label>RERA/HIRA No.</Label>
                            <Input
                                value={form.reraNo || ""}
                                onChange={(e) => setField("reraNo", e.target.value)}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>Project Area</Label>
                            <Input
                                value={form.projectArea || ""}
                                onChange={(e) => setField("projectArea", e.target.value)}
                                placeholder="Optional"
                            />
                        </div>
                    </div>

                    {/* Possession */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label>Possession</Label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={form.possession || ""}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setField("possession", v);
                                    if (v !== "Specify Time") setField("possessionDate", null);
                                }}
                            >
                                <option value="">Select</option>
                                <option value="Immediately">Immediately</option>
                                <option value="Specify Time">Specify Time</option>
                            </select>
                        </div>

                        <div className="grid gap-2">
                            <Label>Possession Date</Label>
                            <Input
                                type="date"
                                value={possessionDateValue}
                                disabled={!possessionIsSpecify}
                                onChange={(e) => setField("possessionDate", e.target.value ? new Date(e.target.value) : null)}
                            />
                            {errors.possessionDate ? (
                                <p className="text-sm text-destructive">{errors.possessionDate}</p>
                            ) : null}
                        </div>
                    </div>

                    {/* Transaction type */}
                    <div className="grid gap-2">
                        <Label>Transaction Type</Label>
                        <Input
                            value={form.transactionType || ""}
                            onChange={(e) => setField("transactionType", e.target.value)}
                            placeholder="Optional"
                        />
                    </div>

                    {/* Description */}
                    <div className="grid gap-2">
                        <Label>Description</Label>
                        <Textarea
                            value={form.description || ""}
                            onChange={(e) => setField("description", e.target.value)}
                            rows={3}
                            placeholder="Optional"
                        />
                    </div>

                    {/* Specification (rich text later) */}
                    <div className="grid gap-2">
                        <Label>Specification</Label>
                        <Textarea
                            value={form.specification || ""}
                            onChange={(e) => setField("specification", e.target.value)}
                            rows={6}
                            placeholder="Optional (Rich text editor will be added later)"
                        />
                    </div>

                    {/* Amenities */}
                    <div className="grid gap-2">
                        <Label>Amenities</Label>
                        <Textarea
                            value={form.amenities || ""}
                            onChange={(e) => setField("amenities", e.target.value)}
                            rows={3}
                            placeholder="Optional"
                        />
                    </div>

                    {/* Upload Video */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label>Youtube Video URL</Label>
                            <Input
                                value={form.youtubeVideoUrl || ""}
                                onChange={(e) => setField("youtubeVideoUrl", e.target.value)}
                                placeholder="Optional"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>Upload Virtual Video</Label>
                            <Input
                                type="file"
                                accept="video/*"
                                onChange={(e) => handleVirtualVideoPick(e.target.files?.[0])}
                            />
                            {form.virtualVideo ? (
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Upload className="w-3 h-3" /> Video selected ✅
                                </div>
                            ) : null}
                        </div>
                    </div>

                    {/* Address */}
                    <div className="grid gap-2">
                        <Label>Project Address</Label>
                        <Textarea
                            value={form.projectAddress || ""}
                            onChange={(e) => setField("projectAddress", e.target.value)}
                            rows={3}
                            placeholder="Optional"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
                            Cancel
                        </Button>
                        <Button onClick={onSubmit} disabled={mutation.isPending}>
                            {mutation.isPending ? "Saving..." : "Submit"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
