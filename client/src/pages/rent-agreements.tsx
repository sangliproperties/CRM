import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import type { DocumentAttachment } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Textarea } from "@/components/ui/textarea";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { Client, Owner, Property } from "@shared/schema";
import { insertRentAgreementSchema } from "@shared/schema";
import { SearchableComboBox } from "@/components/searchable-combobox";
// Because Radix Select does NOT allow empty string as SelectItem value
const NONE = "__none__";

// Helper: Normalize API responses to arrays to avoid ".map is not a function"
function normalizeArray<T>(res: any): T[] {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.items)) return res.items;
    if (Array.isArray(res?.results)) return res.results;
    return [];
}

// Your insertRentAgreementSchema likely expects Date objects for timestamps.
// We'll keep date inputs as string (yyyy-mm-dd) in the form and convert on submit.
const rentAgreementFormSchema = insertRentAgreementSchema
    .extend({
        agreementStartDate: z.union([z.string(), z.date()]),
        agreementEndDate: z.union([z.string(), z.date()]),
    })
    .superRefine((val, ctx) => {
        // Basic end >= start validation (only if both are present)
        const start =
            typeof val.agreementStartDate === "string"
                ? new Date(val.agreementStartDate)
                : val.agreementStartDate;
        const end =
            typeof val.agreementEndDate === "string"
                ? new Date(val.agreementEndDate)
                : val.agreementEndDate;

        if (start instanceof Date && end instanceof Date) {
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                if (end.getTime() < start.getTime()) {
                    ctx.addIssue({
                        code: "custom",
                        path: ["agreementEndDate"],
                        message: "End date must be after start date",
                    });
                }
            }
        }
    });

type RentAgreementFormValues = z.infer<typeof rentAgreementFormSchema>;


// We don't know your exact RentAgreement type export in @shared/schema,
// so we’ll type list items as "any" but keep it consistent with your backend fields.
type RentAgreementRow = any;

export default function RentAgreements() {
    const { toast } = useToast();
    const [editingAgreement, setEditingAgreement] = useState<any | null>(null);
    const [selectedClientId, setSelectedClientId] = useState<string | undefined>(undefined);
    const [selectedOwnerId, setSelectedOwnerId] = useState<string | undefined>(undefined);

    // ✅ date filters (YYYY-MM-DD)
    const [selectedStartDate, setSelectedStartDate] = useState<string>("");
    const [selectedEndDate, setSelectedEndDate] = useState<string>("");

    const [appliedFilters, setAppliedFilters] = useState<{ clientId?: string; ownerId?: string; startDate?: string; endDate?: string }>({});
    // Fetch dropdown data
    const [rentDocFile, setRentDocFile] = useState<File | null>(null);
    const { data: clients = [] } = useQuery({
        queryKey: ["/api/clients"],
        select: (res: any) => normalizeArray<Client>(res),
    });

    const { data: ownersRes } = useQuery({
        queryKey: ["/api/owners", "dropdown"],
        queryFn: async () => {
            const r = await apiRequest("GET", "/api/owners?page=1&pageSize=5000");
            return r.json();
        },
    });
    const owners = (ownersRes?.items ?? ownersRes ?? []) as any[];

    const { data: propertiesRes } = useQuery({
        queryKey: ["/api/properties", "Rent", "dropdown"],
        queryFn: async () => {
            const r = await apiRequest(
                "GET",
                "/api/properties?page=1&pageSize=5000&transactionType=Rent"
            );
            return r.json();
        },
    });

    const properties = (propertiesRes?.items ?? []) as any[];



    const clientOptions = useMemo(() => {
        return clients.map((c: any) => ({
            value: String(c.id),
            label: `${c.name} - ${c.phone}`,
            keywords: `${c.name} ${c.phone}`,
        }));
    }, [clients]);

    const ownerOptions = useMemo(() => {
        return owners.map((o: any) => ({
            value: String(o.id),
            label: `${o.name} - ${o.phone}`,
            keywords: `${o.name} ${o.phone}`,
        }));
    }, [owners]);

    const ownerById = useMemo(() => {
        const map = new Map<string, any>();
        owners.forEach((o: any) => map.set(String(o.id), o));
        return map;
    }, [owners]);

    // IMPORTANT: Use the correct property code column name here (example: p.propertyCode)
    const propertyOptions = useMemo(() => {
        return properties.map((p: any) => {
            const owner = ownerById.get(String(p.ownerId)); // <-- if your property uses different key, change here
            const ownerName = owner?.name ?? "N/A";

            return {
                value: String(p.id),
                label: `${p.title} - ${p.codeNo} (${ownerName})`,
                keywords: `${p.title} ${p.codeNo} ${ownerName}`, // ✅ now search matches owner name too
            };
        });
    }, [properties, ownerById]);

    // Fetch list
    const { data: agreements = [], isLoading: agreementsLoading } = useQuery({
        queryKey: [
            "/api/rent-agreements",
            appliedFilters.clientId ?? "",
            appliedFilters.ownerId ?? "",
            appliedFilters.startDate ?? "",
            appliedFilters.endDate ?? "",
        ],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (appliedFilters.clientId) params.set("clientId", appliedFilters.clientId);
            if (appliedFilters.ownerId) params.set("ownerId", appliedFilters.ownerId);
            if (appliedFilters.startDate) params.set("startDate", appliedFilters.startDate);
            if (appliedFilters.endDate) params.set("endDate", appliedFilters.endDate);

            const url = params.toString()
                ? `/api/rent-agreements?${params.toString()}`
                : "/api/rent-agreements";

            const r = await apiRequest("GET", url);
            return r.json();
        },
        select: (res: any) => normalizeArray<RentAgreementRow>(res),
    });

    // Lookup maps for quick name rendering in list
    const clientMap = useMemo(() => {
        const m = new Map<string, Client>();
        for (const c of clients) m.set(String((c as any).id), c);
        return m;
    }, [clients]);

    const ownerMap = useMemo(() => {
        const m = new Map<string, Owner>();
        for (const o of owners) m.set(String((o as any).id), o);
        return m;
    }, [owners]);

    const propertyMap = useMemo(() => {
        const m = new Map<string, Property>();
        for (const p of properties) m.set(String((p as any).id), p);
        return m;
    }, [properties]);

    const totals = useMemo(() => {
        const count = agreements.length;

        const totalBrokerageSum = agreements.reduce((sum: number, a: any) => {
            const v = a?.totalBrokerage;
            const num =
                typeof v === "number" ? v :
                    typeof v === "string" ? parseFloat(v) :
                        0;
            return sum + (Number.isFinite(num) ? num : 0);
        }, 0);

        return { count, totalBrokerageSum };
    }, [agreements]);

    const emptyValues: Partial<RentAgreementFormValues> = {
        clientId: undefined as any,
        ownerId: undefined as any,
        propertyId: undefined as any,
        inTheNameOf: "",
        agreementStartDate: "" as any,
        agreementEndDate: "" as any,
        crNumber: "",
        licencePeriodMonths: undefined as any,
        rentPerMonth: undefined as any,
        securityDeposit: undefined as any,
        registrationCost: undefined as any,
        totalBrokerage: undefined as any,
        partlyPaid: undefined as any,
        remainingBrokerage: undefined as any,
        documentationCharges: undefined as any,
        stampDuty: undefined as any,
        otherExpenses: undefined as any,
        furnitureAndFixtures: "",
    };


    const form = useForm<RentAgreementFormValues>({
        resolver: zodResolver(rentAgreementFormSchema),
        defaultValues: {
            clientId: undefined as any,
            ownerId: undefined as any,
            propertyId: undefined as any,

            inTheNameOf: "",

            // keep as yyyy-mm-dd strings from input[type=date]
            agreementStartDate: "" as any,
            agreementEndDate: "" as any,

            crNumber: "",
            licencePeriodMonths: undefined as any,

            rentPerMonth: undefined as any,
            securityDeposit: undefined as any,
            registrationCost: undefined as any,
            totalBrokerage: undefined as any,
            partlyPaid: undefined as any,
            remainingBrokerage: undefined as any,
            documentationCharges: undefined as any,
            stampDuty: undefined as any,
            otherExpenses: undefined as any,
            agreementStatus: undefined as any,
            description: "",
            furnitureAndFixtures: "",
        },
    });

    useEffect(() => {
        if (!editingAgreement?.id) return;

        form.reset({
            ...editingAgreement,
            agreementStartDate: editingAgreement.agreementStartDate
                ? new Date(editingAgreement.agreementStartDate).toISOString().slice(0, 10)
                : "",
            agreementEndDate: editingAgreement.agreementEndDate
                ? new Date(editingAgreement.agreementEndDate).toISOString().slice(0, 10)
                : "",
        });
        setRentDocFile(null);
    }, [editingAgreement?.id]);


    async function uploadRentDocumentPdf(agreementId: string, file: File) {
        // Only allow PDF
        const isPdf =
            file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        if (!isPdf) throw new Error("Only PDF file allowed");

        // 1) Get upload URL from backend
        const uploadUrlEndpoint = `/api/documents/upload-url?fileName=${encodeURIComponent(
            file.name
        )}&mimeType=${encodeURIComponent(file.type || "application/pdf")}`;

        const uploadUrlRes = await fetch(uploadUrlEndpoint, {
            method: "GET",
            credentials: "include",
        });

        if (!uploadUrlRes.ok) {
            const text = await uploadUrlRes.text().catch(() => "");
            throw new Error(text || `Failed to get upload URL (${uploadUrlRes.status})`);
        }

        // If server mistakenly returns HTML, show it clearly
        const contentType = uploadUrlRes.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
            const text = await uploadUrlRes.text().catch(() => "");
            throw new Error(
                `Upload URL response is not JSON. Got: ${contentType}. First chars: ${text.slice(0, 60)}`
            );
        }

        const { uploadUrl, fileUrl } = await uploadUrlRes.json();

        // Debug (remove later if you want)
        console.log("uploadUrl:", uploadUrl);
        console.log("fileUrl:", fileUrl);

        const mime = file.type || "application/pdf";
        const isAbsolute = /^https?:\/\//i.test(uploadUrl);

        // 2) Upload the file (PUT)
        const putRes = await fetch(uploadUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": mime },
            // ✅ Signed/absolute URLs usually fail if you send cookies
            credentials: isAbsolute ? "omit" : "include",
        });

        if (!putRes.ok) {
            const text = await putRes.text().catch(() => "");
            throw new Error(text || `PDF upload failed (${putRes.status})`);
        }

        console.log("PUT upload success");

        // 3) Create document record in DB
        const docRes = await apiRequest("POST", "/api/documents", {
            title: "Rent Document",
            description: "",
            entityType: "rent_agreement",
            entityId: agreementId,
            fileUrl,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || "application/pdf",
        });

        const createdDoc = await docRes.json();
        console.log("Document created:", createdDoc);

        if (!createdDoc?.id) {
            throw new Error("Document saved but id not returned from server");
        }

        return createdDoc;
    }

    const mutation = useMutation({
        mutationFn: async (values: RentAgreementFormValues) => {
            // Convert date strings to Date objects (your schema expects Date)
            const payload: any = {
                ...values,
                agreementStartDate:
                    typeof values.agreementStartDate === "string"
                        ? new Date(values.agreementStartDate)
                        : values.agreementStartDate,
                agreementEndDate:
                    typeof values.agreementEndDate === "string"
                        ? new Date(values.agreementEndDate)
                        : values.agreementEndDate,
            };

            if (editingAgreement?.id) {
                // ✅ UPDATE
                await apiRequest("PATCH", `/api/rent-agreements/${editingAgreement.id}`, payload);

                // If user selected a new PDF while editing, upload & update rentDocumentId
                if (rentDocFile) {
                    const doc = await uploadRentDocumentPdf(editingAgreement.id, rentDocFile);

                    if (!doc?.id) throw new Error("Upload succeeded but document id missing");

                    await apiRequest("PATCH", `/api/rent-agreements/${editingAgreement.id}`, {
                        rentDocumentId: doc.id,
                    });
                }

                return;
            }

            // ✅ CREATE
            const createRes = await apiRequest("POST", "/api/rent-agreements", payload);
            const createdAgreement = await createRes.json();

            // Upload doc (optional) and attach to agreement
            if (rentDocFile) {
                const doc = await uploadRentDocumentPdf(createdAgreement.id, rentDocFile);
                await apiRequest("PATCH", `/api/rent-agreements/${createdAgreement.id}`, {
                    rentDocumentId: doc.id,
                });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/rent-agreements"] });

            toast({
                title: "Success",
                description: editingAgreement
                    ? "Agreement updated successfully"
                    : "Rent agreement saved successfully",
            });

            setEditingAgreement(null);
            form.reset(emptyValues);
            setRentDocFile(null);
        },
        onError: (error: Error) => {
            if (isUnauthorizedError(error)) {
                toast({
                    title: "Unauthorized",
                    description: "You are logged out. Logging in again...",
                    variant: "destructive",
                });
                setTimeout(() => {
                    window.location.href = "/api/login";
                }, 500);
                return;
            }

            toast({
                title: "Error",
                description: (error as any)?.message || (editingAgreement ? "Failed to update agreement" : "Failed to save rent agreement"),
                variant: "destructive",
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await apiRequest("DELETE", `/api/rent-agreements/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/rent-agreements"] });
            toast({ title: "Deleted", description: "Agreement deleted successfully" });
        },
        onError: (error: Error) => {
            if (isUnauthorizedError(error)) {
                toast({
                    title: "Unauthorized",
                    description: "You are logged out. Logging in again...",
                    variant: "destructive",
                });
                setTimeout(() => {
                    window.location.href = "/api/login";
                }, 500);
                return;
            }

            toast({
                title: "Error",
                description: "Failed to delete agreement",
                variant: "destructive",
            });
        },
    });

    const onSubmit = (values: RentAgreementFormValues) => {
        mutation.mutate(values);
    };

    return (
        <div className="p-4 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Rent Agreement</CardTitle>
                </CardHeader>

                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                            {/* Row 1: Client, Owner */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Client */}
                                <FormField
                                    control={form.control}
                                    name="clientId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Client Name *</FormLabel>
                                            <FormControl>
                                                <SearchableComboBox
                                                    value={field.value ? String(field.value) : undefined}
                                                    onChange={(v) => field.onChange(v)}
                                                    placeholder="Select client"
                                                    searchPlaceholder="Search by client name or mobile..."
                                                    options={clientOptions}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Owner */}
                                <FormField
                                    control={form.control}
                                    name="ownerId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Owner Name *</FormLabel>
                                            <FormControl>
                                                <SearchableComboBox
                                                    value={field.value ? String(field.value) : undefined}
                                                    onChange={(v) => field.onChange(v)}
                                                    placeholder="Select owner"
                                                    searchPlaceholder="Search by owner name or mobile..."
                                                    options={ownerOptions}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* In the Name of */}
                            <FormField
                                control={form.control}
                                name="inTheNameOf"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>In the Name of</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Enter name (optional)" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Row 2: Property, Dates */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Property */}
                                <FormField
                                    control={form.control}
                                    name="propertyId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Property *</FormLabel>
                                            <FormControl>
                                                <SearchableComboBox
                                                    value={field.value ? String(field.value) : undefined}
                                                    onChange={(v) => field.onChange(v)}
                                                    placeholder="Select property"
                                                    searchPlaceholder="Search by property title or code..."
                                                    options={propertyOptions}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Start Date */}
                                <FormField
                                    control={form.control}
                                    name="agreementStartDate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Agreement Start Date *</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="date"
                                                    value={typeof field.value === "string" ? field.value : ""}
                                                    onChange={(e) => field.onChange(e.target.value)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* End Date */}
                                <FormField
                                    control={form.control}
                                    name="agreementEndDate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Agreement End Date *</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="date"
                                                    value={typeof field.value === "string" ? field.value : ""}
                                                    onChange={(e) => field.onChange(e.target.value)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* Money / Text fields */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <FormField
                                    control={form.control}
                                    name="crNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>CR Number</FormLabel>
                                            <FormControl>
                                                <Input placeholder="CR Number" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="licencePeriodMonths"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Licence Period (Months)</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="e.g. 11"
                                                    value={field.value ?? ""}
                                                    onChange={(e) =>
                                                        field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                                                    }
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="rentPerMonth"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Rent per month</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="e.g. 15000"
                                                    value={field.value ?? ""}
                                                    onChange={(e) =>
                                                        field.onChange(e.target.value === "" ? undefined : e.target.value)
                                                    }
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="securityDeposit"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Security Deposit</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="e.g. 50000"
                                                    value={field.value ?? ""}
                                                    onChange={(e) =>
                                                        field.onChange(e.target.value === "" ? undefined : e.target.value)
                                                    }
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="registrationCost"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Registration Cost</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="e.g. 2000"
                                                    value={field.value ?? ""}
                                                    onChange={(e) =>
                                                        field.onChange(e.target.value === "" ? undefined : e.target.value)
                                                    }
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="totalBrokerage"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Total Brokerage</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="e.g. 10000"
                                                    value={field.value ?? ""}
                                                    onChange={(e) =>
                                                        field.onChange(e.target.value === "" ? undefined : e.target.value)
                                                    }
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="partlyPaid"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Partly Paid</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="e.g. 3000"
                                                    value={field.value ?? ""}
                                                    onChange={(e) =>
                                                        field.onChange(e.target.value === "" ? undefined : e.target.value)
                                                    }
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="remainingBrokerage"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Remaining Brokerage</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="e.g. 7000"
                                                    value={field.value ?? ""}
                                                    onChange={(e) =>
                                                        field.onChange(e.target.value === "" ? undefined : e.target.value)
                                                    }
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="documentationCharges"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Documentation Charges</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="e.g. 500"
                                                    value={field.value ?? ""}
                                                    onChange={(e) =>
                                                        field.onChange(e.target.value === "" ? undefined : e.target.value)
                                                    }
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="stampDuty"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Stamp Duty</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="e.g. 1000"
                                                    value={field.value ?? ""}
                                                    onChange={(e) =>
                                                        field.onChange(e.target.value === "" ? undefined : e.target.value)
                                                    }
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="otherExpenses"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Other Expenses</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="e.g. 250"
                                                    value={field.value ?? ""}
                                                    onChange={(e) =>
                                                        field.onChange(e.target.value === "" ? undefined : e.target.value)
                                                    }
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="agreementStatus"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Agreement Status</FormLabel>
                                            <Select
                                                value={field.value ?? NONE}
                                                onValueChange={(v) => field.onChange(v === NONE ? undefined : v)}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select status" />
                                                    </SelectTrigger>
                                                </FormControl>

                                                <SelectContent>
                                                    <SelectItem value={NONE}>Select status</SelectItem>
                                                    <SelectItem value="Agreement Cancel">Agreement Cancel</SelectItem>
                                                    <SelectItem value="Agreement Renewed">Agreement Renewed</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* Furniture & Fixtures */}
                            <FormField
                                control={form.control}
                                name="furnitureAndFixtures"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Furniture and Fixtures</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Details (optional)" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Description</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="Enter description (optional)" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="space-y-2">
                                <div className="text-sm font-medium">Upload Rent Agreement Document (PDF)</div>

                                <Input
                                    type="file"
                                    accept="application/pdf,.pdf"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0] ?? null;
                                        setRentDocFile(file);
                                    }}
                                />

                                {rentDocFile && (
                                    <div className="text-xs text-muted-foreground">
                                        Selected: {rentDocFile.name}
                                    </div>
                                )}
                            </div>
                            {editingAgreement?.rentDocumentId && (
                                <a
                                    href={`/api/documents/${editingAgreement.rentDocumentId}/view`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 underline"
                                >
                                    View current PDF
                                </a>
                            )}

                            <div className="flex justify-end gap-3 pt-2">
                                {editingAgreement && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            setEditingAgreement(null);
                                            form.reset(emptyValues);
                                            setRentDocFile(null);
                                        }}
                                    >
                                        Cancel Edit
                                    </Button>
                                )}

                                <Button type="submit" disabled={mutation.isPending}>
                                    {mutation.isPending
                                        ? "Saving..."
                                        : editingAgreement
                                            ? "Update Agreement"
                                            : "Submit"}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            {/* Search Filters */}
            <Card>
                <CardHeader>
                    <CardTitle>Search Rent Agreements</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        {/* Client filter */}
                        <div>
                            <div className="text-sm font-medium mb-1">Client</div>
                            <SearchableComboBox
                                value={selectedClientId}
                                onChange={setSelectedClientId}
                                placeholder="Select client"
                                searchPlaceholder="Search by client name or mobile..."
                                options={clientOptions}
                            />
                        </div>

                        {/* Owner filter */}
                        <div>
                            <div className="text-sm font-medium mb-1">Owner</div>
                            <SearchableComboBox
                                value={selectedOwnerId}
                                onChange={setSelectedOwnerId}
                                placeholder="Select owner"
                                searchPlaceholder="Search by owner name or mobile..."
                                options={ownerOptions}
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <Button
                                type="button"
                                onClick={() => {
                                    setAppliedFilters({
                                        clientId: selectedClientId || undefined,
                                        ownerId: selectedOwnerId || undefined,
                                    });
                                }}
                            >
                                Search
                            </Button>

                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setSelectedClientId(undefined);
                                    setSelectedOwnerId(undefined);
                                    setAppliedFilters({});
                                }}
                            >
                                Reset
                            </Button>
                        </div>
                    </div>

                    {/* Optional chips row - next step */}
                    <div className="mt-3 flex flex-wrap gap-2">
                        {appliedFilters.clientId && <span className="text-xs px-2 py-1 rounded bg-slate-100">Client filter applied</span>}
                        {appliedFilters.ownerId && <span className="text-xs px-2 py-1 rounded bg-slate-100">Owner filter applied</span>}
                    </div>
                </CardContent>
            </Card>


            {/* Search By Date */}
            <Card>
                <CardHeader>
                    <CardTitle>Search Rent Agreements By Date</CardTitle>
                </CardHeader>

                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div>
                            <div className="text-sm font-medium mb-1">Start Date</div>
                            <Input
                                type="date"
                                value={selectedStartDate}
                                onChange={(e) => setSelectedStartDate(e.target.value)}
                            />
                        </div>

                        <div>
                            <div className="text-sm font-medium mb-1">End Date</div>
                            <Input
                                type="date"
                                value={selectedEndDate}
                                onChange={(e) => setSelectedEndDate(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-3">
                            <Button
                                type="button"
                                onClick={() => {
                                    setAppliedFilters((prev) => ({
                                        ...prev,
                                        startDate: selectedStartDate || undefined,
                                        endDate: selectedEndDate || undefined,
                                    }));
                                }}
                            >
                                Search
                            </Button>

                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setSelectedStartDate("");
                                    setSelectedEndDate("");
                                    setAppliedFilters((prev) => {
                                        const copy = { ...prev };
                                        delete copy.startDate;
                                        delete copy.endDate;
                                        return copy;
                                    });
                                }}
                            >
                                Reset
                            </Button>
                        </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                        {appliedFilters.startDate && (
                            <span className="text-xs px-2 py-1 rounded bg-slate-100">
                                Start: {appliedFilters.startDate}
                            </span>
                        )}
                        {appliedFilters.endDate && (
                            <span className="text-xs px-2 py-1 rounded bg-slate-100">
                                End: {appliedFilters.endDate}
                            </span>
                        )}
                    </div>
                </CardContent>
            </Card>


            {/* List table */}
            <Card>
                <CardHeader>
                    <CardTitle>Rent Agreements List</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="w-full overflow-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left p-2">Client</th>
                                    <th className="text-left p-2">Owner</th>
                                    <th className="text-left p-2">Property</th>
                                    <th className="text-left p-2">Total Brokerage</th>
                                    <th className="text-left p-2">Location</th>
                                    <th className="text-left p-2">Start Date</th>
                                    <th className="text-left p-2">End Date</th>
                                    <th className="text-left p-2">Status</th>
                                    <th className="text-left p-2">Document</th>
                                    <th className="text-left p-2">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {agreements.length === 0 ? (
                                    <tr>
                                        <td className="p-2 text-muted-foreground" colSpan={10}>
                                            No rent agreements found.
                                        </td>
                                    </tr>
                                ) : (
                                    agreements.map((a: any) => {
                                        const client = clientMap.get(String(a.clientId));
                                        const owner = ownerMap.get(String(a.ownerId));
                                        const property = propertyMap.get(String(a.propertyId));

                                        const start = a.agreementStartDate
                                            ? new Date(a.agreementStartDate).toLocaleDateString()
                                            : "-";
                                        const end = a.agreementEndDate
                                            ? new Date(a.agreementEndDate).toLocaleDateString()
                                            : "-";

                                        return (
                                            <tr key={String(a.id)} className="border-b">
                                                <td className="p-2">
                                                    {client ? `${client.name} (${client.phone})` : a.clientId}
                                                </td>
                                                <td className="p-2">
                                                    {owner ? `${owner.name} (${owner.phone})` : a.ownerId}
                                                </td>
                                                <td className="p-2">
                                                    {property ? `${(property as any).title ?? "Property"}` : a.propertyId}
                                                </td>
                                                <td className="p-2">{a.totalBrokerage ?? "-"}</td>
                                                <td className="p-2">
                                                    {(property as any)?.location || "-"}
                                                </td>
                                                <td className="p-2">{start}</td>
                                                <td className="p-2">{end}</td>
                                                <td className="p-2">
                                                    <span
                                                        className={
                                                            a.agreementStatus === "Agreement Cancel"
                                                                ? "text-red-600 font-semibold"
                                                                : a.agreementStatus === "Agreement Renewed"
                                                                    ? "text-green-600 font-semibold"
                                                                    : "text-muted-foreground"
                                                        }
                                                    >
                                                        {a.agreementStatus ?? "-"}
                                                    </span>
                                                </td>

                                                <td className="p-2">
                                                    {a.rentDocumentId ? (
                                                        <a
                                                            href={`/api/documents/${a.rentDocumentId}/view`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-blue-600 underline"
                                                            onClick={(e) => e.stopPropagation?.()}
                                                        >
                                                            PDF
                                                        </a>
                                                    ) : (
                                                        "-"
                                                    )}
                                                </td>

                                                <td className="p-2">
                                                    <div className="flex gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => setEditingAgreement(a)}
                                                            title="Edit"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>

                                                        <Button
                                                            type="button"
                                                            variant="destructive"
                                                            size="icon"
                                                            onClick={() => deleteMutation.mutate(String(a.id))}
                                                            title="Delete"
                                                            disabled={deleteMutation.isPending}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-end gap-3">
                        <div className="px-4 py-2 rounded bg-slate-50 border text-base font-bold">
                            Total Agreements: {totals.count}
                        </div>

                        <div className="px-4 py-2 rounded bg-slate-50 border text-base font-bold">
                            Total Brokerage:{" "}
                            {totals.totalBrokerageSum.toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
