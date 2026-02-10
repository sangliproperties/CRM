import * as React from "react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Pencil, Trash2, Save, XCircle } from "lucide-react";

// -----------------------------
// Types (kept local to avoid tight coupling)
// -----------------------------
type Client = {
    id: string;
    name?: string | null;
    fullName?: string | null; // some apps store name as fullName
    phone?: string | null;
    mobile?: string | null;
    contactNumber?: string | null;
};

type Owner = {
    id: string;
    name?: string | null;
    fullName?: string | null;
    phone?: string | null;
    mobile?: string | null;
    contactNumber?: string | null;
};

type Property = {
    id: string;
    title?: string | null;
    name?: string | null;
    location?: string | null;
    transactionType?: string | null;
    status?: string | null;
    propertyCode?: string | null; // if you have it later
    codeNo?: string | null;
};

type SellAgreement = {
    id: string;
    clientId: string;
    ownerId: string;
    propertyId: string;

    propertyRegistrationDate: string | Date;
    sellAgreementDate: string | Date;

    finalDealPrice?: string | null;
    totalBrokerage?: string | null;
    partlyPaidBrokerage?: string | null;
    remainingBrokerage?: string | null;

    agreementStatus: "Deal Cancel" | "Deal Done" | "Deal In Progress";
    description?: string | null;
    sellDocumentId?: string | null;
    createdAt?: string | Date;
    updatedAt?: string | Date;
};

// -----------------------------
// Helpers
// -----------------------------
function pickName(x: { name?: string | null; fullName?: string | null } | undefined) {
    return (x?.name || x?.fullName || "").trim();
}

function pickPhone(x: { phone?: string | null; mobile?: string | null; contactNumber?: string | null } | undefined) {
    return (x?.phone || x?.mobile || x?.contactNumber || "").trim();
}

function asDateInputValue(value?: Date | string | null) {
    if (!value) return "";
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function safeMoneyToNumber(v?: string | null) {
    if (!v) return 0;
    const cleaned = String(v).replace(/[^\d.]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
}

function formatIndianMoney(n: number) {
    return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDisplayDate(v?: Date | string | null) {
    if (!v) return "-";
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) return "-";
    try {
        return format(d, "dd/MM/yyyy");
    } catch {
        return "-";
    }
}

function toArray<T>(value: any): T[] {
    if (Array.isArray(value)) return value;

    // common API wrapper patterns
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.items)) return value.items;
    if (Array.isArray(value?.rows)) return value.rows;
    if (Array.isArray(value?.properties)) return value.properties;
    if (Array.isArray(value?.clients)) return value.clients;
    if (Array.isArray(value?.owners)) return value.owners;
    if (Array.isArray(value?.sellAgreements)) return value.sellAgreements;

    return [];
}

// -----------------------------
// Validation schema (matches your requirements)
// -----------------------------
const formSchema = z.object({
    clientId: z.string().min(1, "Client is required"),
    ownerId: z.string().min(1, "Owner is required"),
    propertyId: z.string().min(1, "Property is required"),
    propertyRegistrationDate: z.string().min(1, "Property Registration Date is required"),
    sellAgreementDate: z.string().min(1, "Sell Agreement Date is required"),

    finalDealPrice: z.string().optional(),
    totalBrokerage: z.string().optional(),
    partlyPaidBrokerage: z.string().optional(),
    remainingBrokerage: z.string().optional(),

    ownerBrokerage: z.string().optional(),
    clientBrokerage: z.string().optional(),

    agreementStatus: z.enum(["Deal Cancel", "Deal Done", "Deal In Progress"], {
        required_error: "Agreement Status is required",
        invalid_type_error: "Agreement Status is required",
    }),
    description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function SellAgreements() {
    const { toast } = useToast();
    const { user } = useAuth();
    const [, setLocation] = useLocation();
    const qc = useQueryClient();

    // -----------------------------
    // Role guard (Admin + SuperAdmin/Super Admin)
    // -----------------------------
    const isAllowed =
        user?.role === "Admin" || user?.role === "SuperAdmin" || user?.role === "Super Admin";

    React.useEffect(() => {
        if (user && !isAllowed) {
            toast({
                title: "Access denied",
                description: "Only Admin and Super Admin can access Sell Agreements.",
                variant: "destructive",
            });
            setLocation("/");
        }
    }, [user, isAllowed, toast, setLocation]);

    // -----------------------------
    // Search state (List filtering)
    // -----------------------------
    const [searchClientId, setSearchClientId] = useState<string>("");
    const [searchOwnerId, setSearchOwnerId] = useState<string>("");
    const [searchRegFrom, setSearchRegFrom] = useState<string>("");
    const [searchRegTo, setSearchRegTo] = useState<string>("");
    const [applySearch, setApplySearch] = useState(0); // used to apply filter only on Search button click
    const [sellDocFile, setSellDocFile] = useState<File | null>(null);

    const [clientOpen, setClientOpen] = useState(false);
    const [ownerOpen, setOwnerOpen] = useState(false);
    const [propertyOpen, setPropertyOpen] = useState(false);

    const [searchClientOpen, setSearchClientOpen] = useState(false);
    const [searchOwnerOpen, setSearchOwnerOpen] = useState(false);


    // -----------------------------
    // Data queries
    // -----------------------------
    const clientsQ = useQuery<Client[]>({
        queryKey: ["clients"],
        queryFn: async () => {
            const res = await fetch("/api/clients");
            if (!res.ok) throw new Error("Failed to fetch clients");
            return res.json();
        },
        enabled: !!user && isAllowed,
    });

    const ownersQ = useQuery<Owner[]>({
        queryKey: ["owners"],
        queryFn: async () => {
            const res = await fetch("/api/owners");
            if (!res.ok) throw new Error("Failed to fetch owners");
            return res.json();
        },
        enabled: !!user && isAllowed,
    });

    const propertiesQ = useQuery({
        queryKey: ["properties-dropdown", "Sell"],  // ✅ unique key (no cache conflict)
        queryFn: async () => {
            const res = await fetch(
                "/api/properties?page=1&pageSize=5000&transactionType=Sell"
            );
            if (!res.ok) throw new Error("Failed to fetch properties");
            return res.json(); // returns {items,total,page,pageSize}
        },
        enabled: !!user && isAllowed,
    });

    const sellAgreementsQ = useQuery<SellAgreement[]>({
        queryKey: ["sell-agreements"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/sell-agreements");
            return res.json(); // server returns array
        },
        enabled: !!user && isAllowed,
    });

    // Filter properties: only those which are SOLD (transactionType=Sell already filtered in API)
    const sellProperties = useMemo(() => {
        return toArray<Property>(propertiesQ.data);
    }, [propertiesQ.data]);

    // -----------------------------
    // Form state
    // -----------------------------
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingRow, setEditingRow] = useState<SellAgreement | null>(null);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            clientId: "",
            ownerId: "",
            propertyId: "",
            propertyRegistrationDate: "",
            sellAgreementDate: "",
            finalDealPrice: "",
            totalBrokerage: "",
            partlyPaidBrokerage: "",
            remainingBrokerage: "",
            ownerBrokerage: "",
            clientBrokerage: "",
            // agreementStatus intentionally not set to force user selection
            agreementStatus: undefined,
            description: "",
        },
    });

    const totalBrokerage = form.watch("totalBrokerage");
    const partlyPaid = form.watch("partlyPaidBrokerage");

    // Auto-calc remaining brokerage when total/partly changes
    React.useEffect(() => {
        const total = safeMoneyToNumber(totalBrokerage || "");
        const paid = safeMoneyToNumber(partlyPaid || "");
        const remaining = Math.max(total - paid, 0);
        // Only overwrite if user hasn't manually typed something very different:
        // We'll always update to keep clean; if you want manual override, tell me.
        form.setValue("remainingBrokerage", remaining ? String(remaining) : "");
    }, [totalBrokerage, partlyPaid, form]);

    // -----------------------------
    // Mutations
    // -----------------------------

    async function uploadSellAgreementPdf(sellAgreementId: string, file: File) {
        // Only allow PDF
        const isPdf =
            file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        if (!isPdf) throw new Error("Only PDF file allowed");

        // 1) Get upload URL
        const uploadUrlRes = await fetch(
            `/api/documents/upload-url?fileName=${encodeURIComponent(file.name)}&mimeType=${encodeURIComponent(
                file.type || "application/pdf"
            )}`
        );

        const ct = uploadUrlRes.headers.get("content-type") || "";
        if (!ct.includes("application/json")) {
            const text = await uploadUrlRes.text().catch(() => "");
            throw new Error(`Upload URL response is not JSON. Got: ${ct}. First chars: ${text.slice(0, 80)}`);
        }

        if (!uploadUrlRes.ok) {
            const err = await uploadUrlRes.json().catch(() => null);
            throw new Error(err?.message || "Failed to get upload URL");
        }

        const { uploadUrl, fileUrl } = await uploadUrlRes.json();

        // 2) PUT upload
        const putRes = await fetch(uploadUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type || "application/pdf" },
        });
        if (!putRes.ok) throw new Error("PDF upload failed");

        // 3) Create document row in DB
        const docRes = await fetch("/api/documents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title: "Sell Agreement Document",
                description: "",
                entityType: "sell_agreement",
                entityId: sellAgreementId,
                fileUrl,
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type || "application/pdf",
            }),
        });

        if (!docRes.ok) {
            const err = await docRes.json().catch(() => null);
            throw new Error(err?.message || "Failed to create document record");
        }

        return docRes.json(); // should include .id
    }


    const createMut = useMutation({
        mutationFn: async (payload: any) => {
            // 1) Create sell agreement
            const res = await fetch("/api/sell-agreements", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const msg = await res.json().catch(() => null);
                throw new Error(msg?.message || "Failed to create sell agreement");
            }

            const created = await res.json();

            // 2) If file selected, upload + create document + patch agreement
            if (sellDocFile) {
                const doc = await uploadSellAgreementPdf(created.id, sellDocFile);

                const patchRes = await fetch(`/api/sell-agreements/${created.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sellDocumentId: doc.id }),
                });

                if (!patchRes.ok) {
                    const msg = await patchRes.json().catch(() => null);
                    throw new Error(msg?.message || "Failed to attach PDF to sell agreement");
                }
            }

            return created;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["sell-agreements"] });
            toast({ title: "Saved", description: "Sell agreement created successfully." });
            resetForm();
        },
        onError: (e: any) => {
            toast({ title: "Error", description: e?.message || "Failed", variant: "destructive" });
        },
    });

    const updateMut = useMutation({
        mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
            // 1) Update agreement fields
            const res = await fetch(`/api/sell-agreements/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const msg = await res.json().catch(() => null);
                throw new Error(msg?.message || "Failed to update sell agreement");
            }

            const updated = await res.json();

            // 2) If user selected a NEW pdf while editing → upload + patch doc id
            if (sellDocFile) {
                const doc = await uploadSellAgreementPdf(id, sellDocFile);

                const patchRes = await fetch(`/api/sell-agreements/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sellDocumentId: doc.id }),
                });

                if (!patchRes.ok) {
                    const msg = await patchRes.json().catch(() => null);
                    throw new Error(msg?.message || "Failed to attach PDF to sell agreement");
                }
            }

            return updated;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["sell-agreements"] });
            toast({ title: "Updated", description: "Sell agreement updated successfully." });
            resetForm();
        },
        onError: (e: any) => {
            toast({ title: "Error", description: e?.message || "Failed", variant: "destructive" });
        },
    });

    const deleteMut = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/sell-agreements/${id}`, { method: "DELETE" });
            if (!res.ok && res.status !== 204) {
                const msg = await res.json().catch(() => null);
                throw new Error(msg?.message || "Failed to delete sell agreement");
            }
            return true;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["sell-agreements"] });
            toast({ title: "Deleted", description: "Sell agreement deleted." });
        },
        onError: (e: any) => {
            toast({ title: "Error", description: e?.message || "Failed", variant: "destructive" });
        },
    });

    function resetForm() {
        setEditingId(null);
        setEditingRow(null);      // ✅ ADD
        setSellDocFile(null);     // ✅ ADD
        form.reset({
            clientId: "",
            ownerId: "",
            propertyId: "",
            propertyRegistrationDate: "",
            sellAgreementDate: "",
            finalDealPrice: "",
            totalBrokerage: "",
            partlyPaidBrokerage: "",
            remainingBrokerage: "",
            ownerBrokerage: "",
            clientBrokerage: "",
            // keep status empty (no default)
            agreementStatus: undefined,
            description: "",
        });
    }

    function onEdit(row: SellAgreement) {
        setEditingId(row.id);
        setEditingRow(row);      // ✅ ADD (so we can show current PDF)
        setSellDocFile(null);    // ✅ ADD (clear selected file on edit start)
        form.reset({
            clientId: row.clientId || "",
            ownerId: row.ownerId || "",
            propertyId: row.propertyId || "",
            propertyRegistrationDate: asDateInputValue(row.propertyRegistrationDate),
            sellAgreementDate: asDateInputValue(row.sellAgreementDate),
            finalDealPrice: row.finalDealPrice || "",
            totalBrokerage: row.totalBrokerage || "",
            partlyPaidBrokerage: row.partlyPaidBrokerage || "",
            remainingBrokerage: row.remainingBrokerage || "",
            ownerBrokerage: (row as any).ownerBrokerage || "",
            clientBrokerage: (row as any).clientBrokerage || "",
            agreementStatus: row.agreementStatus as any,
            description: row.description || "",
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function onDelete(id: string) {
        const ok = window.confirm("Are you sure you want to delete this sell agreement?");
        if (!ok) return;
        deleteMut.mutate(id);
    }

    function submit(values: FormValues) {
        const payload = {
            clientId: values.clientId,
            ownerId: values.ownerId,
            propertyId: values.propertyId,
            propertyRegistrationDate: new Date(values.propertyRegistrationDate),
            sellAgreementDate: new Date(values.sellAgreementDate),

            finalDealPrice: values.finalDealPrice ?? "",
            totalBrokerage: values.totalBrokerage ?? "",
            partlyPaidBrokerage: values.partlyPaidBrokerage ?? "",
            remainingBrokerage: values.remainingBrokerage ?? "",
            ownerBrokerage: values.ownerBrokerage ?? "",
            clientBrokerage: values.clientBrokerage ?? "",

            agreementStatus: values.agreementStatus,
            description: values.description ?? "",
        };

        if (editingId) {
            updateMut.mutate({ id: editingId, payload });
        } else {
            createMut.mutate(payload);
        }
    }

    // -----------------------------
    // Build lookup maps for display
    // -----------------------------
    const clientMap = useMemo(() => {
        const map = new Map<string, Client>();
        toArray<Client>(clientsQ.data).forEach((c) => map.set(c.id, c));
        return map;
    }, [clientsQ.data]);

    const ownerMap = useMemo(() => {
        const map = new Map<string, Owner>();
        toArray<Owner>(ownersQ.data).forEach((o) => map.set(o.id, o));
        return map;
    }, [ownersQ.data]);

    const propertyMap = useMemo(() => {
        const map = new Map<string, Property>();
        toArray<Property>(propertiesQ.data).forEach((p) => map.set(p.id, p));
        return map;
    }, [propertiesQ.data]);

    // -----------------------------
    // Filtered list (applies only after clicking Search)
    // -----------------------------
    const filteredSellAgreements = useMemo(() => {
        const rows = toArray<SellAgreement>(sellAgreementsQ.data);

        // if user didn't click Search yet and all filters are empty, show all
        const hasAnyFilter = !!searchClientId || !!searchOwnerId || !!searchRegFrom || !!searchRegTo;
        if (!hasAnyFilter) return rows;

        return rows.filter((r) => {
            if (searchClientId && r.clientId !== searchClientId) return false;
            if (searchOwnerId && r.ownerId !== searchOwnerId) return false;

            if (searchRegFrom || searchRegTo) {
                const d = new Date(r.sellAgreementDate as any);
                if (Number.isNaN(d.getTime())) return false;

                if (searchRegFrom) {
                    const from = new Date(searchRegFrom);
                    from.setHours(0, 0, 0, 0);
                    if (d < from) return false;
                }

                if (searchRegTo) {
                    const to = new Date(searchRegTo);
                    to.setHours(23, 59, 59, 999);
                    if (d > to) return false;
                }
            }

            return true;
        });
        // applySearch forces memo recompute when clicking Search button even if values didn't change
    }, [sellAgreementsQ.data, searchClientId, searchOwnerId, searchRegFrom, searchRegTo, applySearch]);

    const totalAgreements = filteredSellAgreements.length;

    const totalBrokerageSum = useMemo(() => {
        return filteredSellAgreements.reduce((sum, row) => {
            return sum + safeMoneyToNumber(row.totalBrokerage ?? "");
        }, 0);
    }, [filteredSellAgreements]);

    // -----------------------------
    // UI
    // -----------------------------
    if (!user) return null;
    if (!isAllowed) return null;

    const loading =
        clientsQ.isLoading || ownersQ.isLoading || propertiesQ.isLoading || sellAgreementsQ.isLoading;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Sell Agreements</CardTitle>

                    <div className="flex items-center gap-2">
                        {editingId ? (
                            <div className="text-sm text-muted-foreground">
                                Editing: <span className="font-medium">{editingId.slice(0, 8)}...</span>
                            </div>
                        ) : null}
                        <Button type="button" variant="outline" onClick={resetForm}>
                            <XCircle className="h-4 w-4 mr-2" />
                            Reset
                        </Button>
                    </div>
                </CardHeader>

                <CardContent>
                    <form onSubmit={form.handleSubmit(submit)} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Client */}
                            <div className="space-y-2">
                                <Label>Client Name *</Label>

                                <Popover open={clientOpen} onOpenChange={setClientOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            role="combobox"
                                            className="w-full justify-between"
                                        >
                                            {(() => {
                                                const selected = clientMap.get(form.watch("clientId"));
                                                const name = pickName(selected) || "Select Client";
                                                const phone = pickPhone(selected);
                                                return phone ? `${name} (${phone})` : name;
                                            })()}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>

                                    <PopoverContent className="w-full p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="Search client by name or mobile..." />
                                            <CommandEmpty>No client found.</CommandEmpty>

                                            <CommandGroup>
                                                {toArray<Client>(clientsQ.data).map((c) => {
                                                    const label = `${pickName(c)} ${pickPhone(c)}`.trim();
                                                    const isSelected = form.watch("clientId") === c.id;

                                                    return (
                                                        <CommandItem
                                                            key={c.id}
                                                            value={label}
                                                            onSelect={() => {
                                                                form.setValue("clientId", c.id, { shouldValidate: true });
                                                                setClientOpen(false); // ✅ close after select
                                                            }}
                                                        >
                                                            <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                                                            {pickName(c) || "Unnamed Client"}
                                                            {pickPhone(c) ? ` (${pickPhone(c)})` : ""}
                                                        </CommandItem>
                                                    );
                                                })}
                                            </CommandGroup>
                                        </Command>
                                    </PopoverContent>
                                </Popover>

                                {form.formState.errors.clientId ? (
                                    <p className="text-sm text-destructive">{form.formState.errors.clientId.message}</p>
                                ) : null}
                            </div>

                            {/* Owner */}
                            <div className="space-y-2">
                                <Label>Owner Name *</Label>

                                <Popover open={ownerOpen} onOpenChange={setOwnerOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            role="combobox"
                                            className="w-full justify-between"
                                        >
                                            {(() => {
                                                const selected = ownerMap.get(form.watch("ownerId"));
                                                const name = pickName(selected) || "Select Owner";
                                                const phone = pickPhone(selected);
                                                return phone ? `${name} (${phone})` : name;
                                            })()}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>

                                    <PopoverContent className="w-full p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="Search owner by name or mobile..." />
                                            <CommandEmpty>No owner found.</CommandEmpty>

                                            <CommandGroup>
                                                {toArray<Owner>(ownersQ.data).map((o) => {
                                                    const label = `${pickName(o)} ${pickPhone(o)}`.trim();
                                                    const isSelected = form.watch("ownerId") === o.id;

                                                    return (
                                                        <CommandItem
                                                            key={o.id}
                                                            value={label}
                                                            onSelect={() => {
                                                                form.setValue("ownerId", o.id, { shouldValidate: true });
                                                                setOwnerOpen(false);
                                                            }}

                                                        >
                                                            <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                                                            {pickName(o) || "Unnamed Owner"}
                                                            {pickPhone(o) ? ` (${pickPhone(o)})` : ""}
                                                        </CommandItem>
                                                    );
                                                })}
                                            </CommandGroup>
                                        </Command>
                                    </PopoverContent>
                                </Popover>

                                {form.formState.errors.ownerId ? (
                                    <p className="text-sm text-destructive">{form.formState.errors.ownerId.message}</p>
                                ) : null}
                            </div>

                            {/* Property */}
                            <div className="space-y-2">
                                <Label>Property *</Label>

                                <Popover open={propertyOpen} onOpenChange={setPropertyOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            role="combobox"
                                            className="w-full justify-between"
                                        >
                                            {(() => {
                                                const selected = propertyMap.get(form.watch("propertyId"));
                                                const title = (selected?.title || selected?.name || "Select Property").trim();
                                                const code = (selected as any)?.codeNo ? ` (${(selected as any).codeNo})` : "";
                                                return `${title}${code}`;
                                            })()}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>

                                    <PopoverContent className="w-full p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="Search property by code or title..." />
                                            <CommandEmpty>No property found.</CommandEmpty>

                                            <CommandGroup>
                                                {sellProperties.map((p) => {
                                                    const title = (p.title || p.name || "Unnamed Property").trim();
                                                    const code = (p as any)?.codeNo ? String((p as any).codeNo) : "";
                                                    const label = `${code} ${title}`.trim();
                                                    const isSelected = form.watch("propertyId") === p.id;

                                                    return (
                                                        <CommandItem
                                                            key={p.id}
                                                            value={label}
                                                            onSelect={() => {
                                                                form.setValue("propertyId", p.id, { shouldValidate: true });
                                                                setPropertyOpen(false);
                                                            }}
                                                        >
                                                            <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                                                            {title}
                                                            {code ? ` (${code})` : ""}
                                                            {p.location ? ` - ${p.location}` : ""}
                                                        </CommandItem>
                                                    );
                                                })}
                                            </CommandGroup>
                                        </Command>
                                    </PopoverContent>
                                </Popover>

                                {form.formState.errors.propertyId ? (
                                    <p className="text-sm text-destructive">{form.formState.errors.propertyId.message}</p>
                                ) : null}
                            </div>

                            {/* Property Registration Date */}
                            <div className="space-y-2">
                                <Label>Property Registration Date *</Label>
                                <Input type="date" {...form.register("propertyRegistrationDate")} />
                                {form.formState.errors.propertyRegistrationDate ? (
                                    <p className="text-sm text-destructive">
                                        {form.formState.errors.propertyRegistrationDate.message}
                                    </p>
                                ) : null}
                            </div>

                            {/* Sell Agreement Date */}
                            <div className="space-y-2">
                                <Label>Sell Agreement Date *</Label>
                                <Input type="date" {...form.register("sellAgreementDate")} />
                                {form.formState.errors.sellAgreementDate ? (
                                    <p className="text-sm text-destructive">
                                        {form.formState.errors.sellAgreementDate.message}
                                    </p>
                                ) : null}
                            </div>

                            {/* Agreement Status */}
                            <div className="space-y-2">
                                <Label>Agreement Status *</Label>
                                <Select
                                    // we keep it possibly undefined to avoid default option
                                    value={(form.watch("agreementStatus") as any) ?? ""}
                                    onValueChange={(v) => form.setValue("agreementStatus", v as any, { shouldValidate: true })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Deal Cancel">Deal Cancel</SelectItem>
                                        <SelectItem value="Deal Done">Deal Done</SelectItem>
                                        <SelectItem value="Deal In Progress">Deal In Progress</SelectItem>
                                    </SelectContent>
                                </Select>
                                {form.formState.errors.agreementStatus ? (
                                    <p className="text-sm text-destructive">
                                        {form.formState.errors.agreementStatus.message as any}
                                    </p>
                                ) : null}
                            </div>

                            {/* Final Deal Price */}
                            <div className="space-y-2">
                                <Label>Final Deal Price</Label>
                                <Input placeholder="Enter Final Deal Price" {...form.register("finalDealPrice")} />
                            </div>

                            {/* Total Brokerage */}
                            <div className="space-y-2">
                                <Label>Total Brokerage</Label>
                                <Input placeholder="Enter Total Brokerage" {...form.register("totalBrokerage")} />
                            </div>

                            {/* Partly Paid Brokerage */}
                            <div className="space-y-2">
                                <Label>Partly Paid Brokerage</Label>
                                <Input placeholder="Enter Partly Paid Brokerage" {...form.register("partlyPaidBrokerage")} />
                            </div>

                            {/* Remaining Brokerage */}
                            <div className="space-y-2">
                                <Label>Remaining Brokerage</Label>
                                <Input placeholder="Enter Remaining Brokerage" {...form.register("remainingBrokerage")} />
                            </div>

                            {/* Owner Brokerage */}
                            <div className="space-y-2">
                                <Label>Owner Brokerage</Label>
                                <Input placeholder="Enter Owner Brokerage" {...form.register("ownerBrokerage")} />
                            </div>

                            {/* Client Brokerage */}
                            <div className="space-y-2">
                                <Label>Client Brokerage</Label>
                                <Input placeholder="Enter Client Brokerage" {...form.register("clientBrokerage")} />
                            </div>
                        </div>

                        <Separator />

                        {/* Description */}
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea placeholder="Enter description..." rows={4} {...form.register("description")} />
                        </div>

                        {/* ✅ Upload Rent Agreement Document (PDF) */}
                        <div className="space-y-2">
                            <Label>Upload Rent Agreement Document (PDF)</Label>

                            {/* Show existing PDF link in edit mode */}
                            {editingId && (editingRow?.sellDocumentId || null) ? (
                                <div className="text-sm">
                                    Current PDF:{" "}
                                    <a
                                        href={`/api/documents/${editingRow!.sellDocumentId}/view`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-blue-600 underline"
                                    >
                                        View
                                    </a>
                                </div>
                            ) : null}

                            <Input
                                type="file"
                                accept="application/pdf,.pdf"
                                onChange={(e) => setSellDocFile(e.target.files?.[0] ?? null)}
                            />

                            {sellDocFile ? (
                                <div className="text-xs text-muted-foreground">Selected: {sellDocFile.name}</div>
                            ) : null}
                        </div>

                        <div className="flex items-center gap-2">
                            <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                                <Save className="h-4 w-4 mr-2" />
                                {editingId ? "Update" : "Submit"}
                            </Button>
                            {editingId ? (
                                <Button type="button" variant="outline" onClick={resetForm}>
                                    Cancel Edit
                                </Button>
                            ) : null}
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Search Sell Agreements</CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="space-y-2">
                            <div className="space-y-2">
                                <Label>Client</Label>

                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            role="combobox"
                                            className="w-full justify-between"
                                        >
                                            {searchClientId
                                                ? (() => {
                                                    const c = clientMap.get(searchClientId);
                                                    const name = pickName(c) || "Client";
                                                    const phone = pickPhone(c);
                                                    return phone ? `${name} (${phone})` : name;
                                                })()
                                                : "Select client"}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>

                                    <PopoverContent className="w-full p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="Search client by name or mobile..." />
                                            <CommandEmpty>No client found.</CommandEmpty>

                                            <CommandGroup>
                                                {/* All option */}
                                                <CommandItem
                                                    value="all"
                                                    onSelect={() => {
                                                        setSearchClientId("");
                                                        setSearchClientOpen(false); // ✅ close
                                                    }}
                                                >
                                                    <Check className={cn("mr-2 h-4 w-4", !searchClientId ? "opacity-100" : "opacity-0")} />
                                                    All
                                                </CommandItem>

                                                {toArray<Client>(clientsQ.data).map((c) => {
                                                    const name = pickName(c) || "Unnamed Client";
                                                    const phone = pickPhone(c);
                                                    const searchable = `${name} ${phone}`.toLowerCase();
                                                    const selected = searchClientId === c.id;

                                                    return (
                                                        <CommandItem
                                                            key={c.id}
                                                            value={searchable}
                                                            onSelect={() => {
                                                                setSearchClientId(c.id);
                                                                setSearchClientOpen(false); // ✅ close
                                                            }}
                                                        >
                                                            <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                                                            {name}{phone ? ` (${phone})` : ""}
                                                        </CommandItem>
                                                    );
                                                })}
                                            </CommandGroup>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="space-y-2">
                                <Label>Owner</Label>

                                <Popover open={searchOwnerOpen} onOpenChange={setSearchOwnerOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            role="combobox"
                                            className="w-full justify-between"
                                        >
                                            {searchOwnerId
                                                ? (() => {
                                                    const o = ownerMap.get(searchOwnerId);
                                                    const name = pickName(o) || "Owner";
                                                    const phone = pickPhone(o);
                                                    return phone ? `${name} (${phone})` : name;
                                                })()
                                                : "Select owner"}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>

                                    <PopoverContent className="w-full p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="Search owner by name or mobile..." />
                                            <CommandEmpty>No owner found.</CommandEmpty>

                                            <CommandGroup>
                                                {/* All option */}
                                                <CommandItem
                                                    value="all"
                                                    onSelect={() => {
                                                        setSearchOwnerId("");
                                                        setSearchOwnerOpen(false); // ✅ close
                                                    }}
                                                >
                                                    <Check className={cn("mr-2 h-4 w-4", !searchOwnerId ? "opacity-100" : "opacity-0")} />
                                                    All
                                                </CommandItem>

                                                {toArray<Owner>(ownersQ.data).map((o) => {
                                                    const name = pickName(o) || "Unnamed Owner";
                                                    const phone = pickPhone(o);
                                                    const searchable = `${name} ${phone}`.toLowerCase();
                                                    const selected = searchOwnerId === o.id;

                                                    return (
                                                        <CommandItem
                                                            key={o.id}
                                                            value={searchable}
                                                            onSelect={() => {
                                                                setSearchOwnerId(o.id);
                                                                setSearchOwnerOpen(false); // ✅ close
                                                            }}
                                                        >
                                                            <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                                                            {name}{phone ? ` (${phone})` : ""}
                                                        </CommandItem>
                                                    );
                                                })}
                                            </CommandGroup>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                type="button"
                                onClick={() => {
                                    setApplySearch((n) => n + 1);
                                    toast({ title: "Search applied" });
                                }}
                            >
                                Search
                            </Button>

                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setSearchClientId("");
                                    setSearchOwnerId("");
                                    setApplySearch((n) => n + 1);
                                }}
                            >
                                Reset
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>


            <Card>
                <CardHeader>
                    <CardTitle>Search Sell Agreements By Sell Agreement Date</CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="space-y-2">
                            <Label>Start Date</Label>
                            <Input
                                type="date"
                                value={searchRegFrom}
                                onChange={(e) => setSearchRegFrom(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>End Date</Label>
                            <Input
                                type="date"
                                value={searchRegTo}
                                onChange={(e) => setSearchRegTo(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-2">
                            <Button
                                type="button"
                                onClick={() => {
                                    setApplySearch((n) => n + 1);
                                    toast({ title: "Date search applied" });
                                }}
                            >
                                Search
                            </Button>

                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setSearchRegFrom("");
                                    setSearchRegTo("");
                                    setApplySearch((n) => n + 1);
                                }}
                            >
                                Reset
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Sell Agreements List</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-sm text-muted-foreground">Loading...</div>
                    ) : (
                        <div className="w-full overflow-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Client</TableHead>
                                        <TableHead>Owner</TableHead>
                                        <TableHead>Property</TableHead>
                                        <TableHead>Location</TableHead>
                                        <TableHead>Property Registration Date</TableHead>
                                        <TableHead>Sell Agreement Date</TableHead>
                                        <TableHead>Final Deal Price</TableHead>
                                        <TableHead>Total Brokerage</TableHead>
                                        <TableHead>Remaining Brokerage</TableHead>   {/* ✅ NEW */}
                                        <TableHead>Status</TableHead>
                                        <TableHead>PDF</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {filteredSellAgreements.map((row) => {
                                        const client = clientMap.get(row.clientId);
                                        const owner = ownerMap.get(row.ownerId);
                                        const property = propertyMap.get(row.propertyId);

                                        const clientName = pickName(client) || "—";
                                        const clientPhone = pickPhone(client);
                                        const ownerName = pickName(owner) || "—";
                                        const ownerPhone = pickPhone(owner);

                                        const propertyTitle = (property?.title || property?.name || "—").trim();
                                        const location = (property?.location || "—").trim();

                                        return (
                                            <TableRow key={row.id}>
                                                <TableCell>
                                                    {clientName}
                                                    {clientPhone ? ` (${clientPhone})` : ""}
                                                </TableCell>
                                                <TableCell>
                                                    {ownerName}
                                                    {ownerPhone ? ` (${ownerPhone})` : ""}
                                                </TableCell>
                                                <TableCell>{propertyTitle}</TableCell>
                                                <TableCell>{location}</TableCell>
                                                <TableCell>{formatDisplayDate(row.propertyRegistrationDate)}</TableCell>
                                                <TableCell>{formatDisplayDate(row.sellAgreementDate)}</TableCell>
                                                <TableCell>{row.finalDealPrice || "-"}</TableCell>
                                                <TableCell>{row.totalBrokerage || "-"}</TableCell>
                                                <TableCell className="text-destructive font-bold">
                                                    {row.remainingBrokerage || "-"}
                                                </TableCell>
                                                <TableCell
                                                    className={
                                                        row.agreementStatus === "Deal Cancel" ? "text-destructive font-medium" : "font-medium"
                                                    }
                                                >
                                                    {row.agreementStatus || "-"}
                                                </TableCell>
                                                <TableCell>
                                                    {row.sellDocumentId ? (
                                                        <a
                                                            href={`/api/documents/${row.sellDocumentId}/view`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-blue-600 underline"
                                                        >
                                                            PDF
                                                        </a>
                                                    ) : (
                                                        "-"
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            type="button"
                                                            size="icon"
                                                            variant="outline"
                                                            onClick={() => onEdit(row)}
                                                            title="Edit"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="icon"
                                                            variant="destructive"
                                                            onClick={() => onDelete(row.id)}
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}

                                    {filteredSellAgreements.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={12} className="text-center text-sm text-muted-foreground">
                                                No sell agreements found.
                                            </TableCell>
                                        </TableRow>
                                    ) : null}

                                    {filteredSellAgreements.length > 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={12}>
                                                <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-end gap-3">
                                                    <div className="px-4 py-2 rounded bg-slate-50 border text-base font-bold">
                                                        Total Agreements: {totalAgreements}
                                                    </div>
                                                    <div className="px-4 py-2 rounded bg-slate-50 border text-base font-bold">
                                                        Total Brokerage: {formatIndianMoney(totalBrokerageSum)}
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : null}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
