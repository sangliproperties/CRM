import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

import type { ProjectOwner, InsertProjectOwner } from "@shared/schema";
import { insertProjectOwnerSchema } from "@shared/schema";

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialData?: ProjectOwner | null;
};

const formSchema = insertProjectOwnerSchema;

export function ProjectOwnerFormDialog({ open, onOpenChange, initialData }: Props) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const isEdit = !!initialData?.id;

    const emptyForm: InsertProjectOwner = useMemo(
        () => ({
            name: "",
            mobileNumber: "",
            otherNumber: "",
            email: "",
            uniqueNumber: "",
            address: "",
            companyName: "",
            dateOfBirth: null,
            websiteUrl: "",
            ownerPhoto: "",
        }),
        []
    );

    const [form, setForm] = useState<InsertProjectOwner>(emptyForm);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (open) {
            if (initialData) {
                setForm({
                    name: initialData.name ?? "",
                    mobileNumber: initialData.mobileNumber ?? "",
                    otherNumber: initialData.otherNumber ?? "",
                    email: initialData.email ?? "",
                    uniqueNumber: initialData.uniqueNumber ?? "",
                    address: initialData.address ?? "",
                    companyName: initialData.companyName ?? "",
                    dateOfBirth: initialData.dateOfBirth ? new Date(initialData.dateOfBirth) : null,
                    websiteUrl: initialData.websiteUrl ?? "",
                    ownerPhoto: initialData.ownerPhoto ?? "",
                });
            } else {
                setForm(emptyForm);
            }
            setErrors({});
        }
    }, [open, initialData, emptyForm]);

    const mutation = useMutation({
        mutationFn: async (payload: InsertProjectOwner) => {
            const url = isEdit ? `/api/project-owners/${initialData!.id}` : "/api/project-owners";
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
            queryClient.invalidateQueries({ queryKey: ["/api/project-owners"] });
            toast({
                title: isEdit ? "Project Owner updated" : "Project Owner created",
            });
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

    const setField = (key: keyof InsertProjectOwner, value: any) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleMobileChange = (v: string) => {
        const digitsOnly = v.replace(/\D/g, "").slice(0, 10);
        setField("mobileNumber", digitsOnly);
    };

    const handlePhotoPick = async (file?: File | null) => {
        if (!file) {
            setField("ownerPhoto", "");
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const result = typeof reader.result === "string" ? reader.result : "";
            setField("ownerPhoto", result);
        };
        reader.readAsDataURL(file);
    };

    const validate = () => {
        try {
            formSchema.parse(form);
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

        // If date is empty string / null in UI, keep it null
        const payload: InsertProjectOwner = {
            ...form,
            dateOfBirth: form.dateOfBirth ? new Date(form.dateOfBirth) : null,
            email: form.email?.trim() ? form.email.trim() : "",
            websiteUrl: form.websiteUrl?.trim() ? form.websiteUrl.trim() : "",
            otherNumber: form.otherNumber?.trim() ? form.otherNumber.trim() : "",
            uniqueNumber: form.uniqueNumber?.trim() ? form.uniqueNumber.trim() : "",
            address: form.address?.trim() ? form.address.trim() : "",
            companyName: form.companyName?.trim() ? form.companyName.trim() : "",
        };

        mutation.mutate(payload);
    };

    const dobValue = form.dateOfBirth
        ? new Date(form.dateOfBirth).toISOString().slice(0, 10)
        : "";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit Project Owner" : "Add Project Owner"}</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4">
                    <div className="grid gap-2">
                        <Label>Project Owner Name *</Label>
                        <Input
                            value={form.name}
                            onChange={(e) => setField("name", e.target.value)}
                            placeholder="Enter owner name"
                        />
                        {errors.name ? <p className="text-sm text-destructive">{errors.name}</p> : null}
                    </div>

                    <div className="grid gap-2">
                        <Label>Mobile Number *</Label>
                        <Input
                            value={form.mobileNumber}
                            onChange={(e) => handleMobileChange(e.target.value)}
                            placeholder="10 digit mobile number"
                            inputMode="numeric"
                        />
                        {errors.mobileNumber ? (
                            <p className="text-sm text-destructive">{errors.mobileNumber}</p>
                        ) : null}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label>Other Number</Label>
                            <Input
                                value={form.otherNumber || ""}
                                onChange={(e) => setField("otherNumber", e.target.value)}
                                placeholder="Optional"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>Email</Label>
                            <Input
                                value={form.email || ""}
                                onChange={(e) => setField("email", e.target.value)}
                                placeholder="Optional"
                            />
                            {errors.email ? <p className="text-sm text-destructive">{errors.email}</p> : null}
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label>Unique Number</Label>
                            <Input
                                value={form.uniqueNumber || ""}
                                onChange={(e) => setField("uniqueNumber", e.target.value)}
                                placeholder="Optional"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>Company Name</Label>
                            <Input
                                value={form.companyName || ""}
                                onChange={(e) => setField("companyName", e.target.value)}
                                placeholder="Optional"
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>Address</Label>
                        <Textarea
                            value={form.address || ""}
                            onChange={(e) => setField("address", e.target.value)}
                            placeholder="Optional"
                            rows={3}
                        />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label>Date Of Birth</Label>
                            <Input
                                type="date"
                                value={dobValue}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setField("dateOfBirth", v ? new Date(v) : null);
                                }}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>Website URL</Label>
                            <Input
                                value={form.websiteUrl || ""}
                                onChange={(e) => setField("websiteUrl", e.target.value)}
                                placeholder="Optional"
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>Owner Photo</Label>
                        <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handlePhotoPick(e.target.files?.[0])}
                        />
                        {form.ownerPhoto ? (
                            <div className="text-xs text-muted-foreground">
                                Photo selected ✅
                            </div>
                        ) : null}
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={mutation.isPending}
                        >
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