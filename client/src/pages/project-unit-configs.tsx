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
import { Pencil, Trash2, Plus } from "lucide-react";

type Tower = {
    id: string;
    projectId: string;
    name?: string | null;
};

type UnitConfig = {
    id: string;
    projectId: string;

    // NEW FIELDS
    towerId?: string | null;
    propertyType?: string | null;
    bedroom?: string | null;
    sellPrice?: string | null;
    area?: string | null;
    builtUpArea?: string | null;
    carpetArea?: string | null;
    otherArea?: string | null;
    totalUnit?: number | null;

    createdAt?: string | null;

    // If your API returns towerName directly, you can use it.
    // towerName?: string | null;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { credentials: "include", ...init });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed: ${res.status}`);
    }

    // ✅ Handle 204 No Content (common for DELETE)
    if (res.status === 204) {
        return undefined as unknown as T;
    }

    // ✅ Handle empty body even if status is 200/201
    const text = await res.text().catch(() => "");
    return (text ? JSON.parse(text) : undefined) as T;
}

export default function ProjectUnitConfigsPage() {
    const { toast } = useToast();
    const qc = useQueryClient();
    const [, setLocation] = useLocation();
    const { projectId } = useParams<{ projectId: string }>();

    // Load towers for dropdown
    const { data: towers = [] } = useQuery<Tower[]>({
        queryKey: ["/api/projects", projectId, "towers"],
        queryFn: () => fetchJson<Tower[]>(`/api/projects/${projectId}/towers`),
        enabled: !!projectId,
    });

    // Load unit configs
    const { data: items = [], isLoading } = useQuery<UnitConfig[]>({
        queryKey: ["/api/projects", projectId, "unit-configs"],
        queryFn: () => fetchJson<UnitConfig[]>(`/api/projects/${projectId}/unit-configs`),
        enabled: !!projectId,
    });

    const [createOpen, setCreateOpen] = React.useState(false);
    const [editOpen, setEditOpen] = React.useState(false);
    const [editing, setEditing] = React.useState<UnitConfig | null>(null);

    // Form state (NEW)
    const [towerId, setTowerId] = React.useState("");
    const [propertyType, setPropertyType] = React.useState("");
    const [bedroom, setBedroom] = React.useState("");
    const [sellPrice, setSellPrice] = React.useState("");
    const [area, setArea] = React.useState("");
    const [builtUpArea, setBuiltUpArea] = React.useState("");
    const [carpetArea, setCarpetArea] = React.useState("");
    const [otherArea, setOtherArea] = React.useState("");
    const [totalUnit, setTotalUnit] = React.useState("");

    const resetForm = () => {
        setTowerId("");
        setPropertyType("");
        setBedroom("");
        setSellPrice("");
        setArea("");
        setBuiltUpArea("");
        setCarpetArea("");
        setOtherArea("");
        setTotalUnit("");
    };

    const opt = (v: string) => (v.trim() ? v.trim() : null);

    const createMutation = useMutation({
        mutationFn: async () => {
            if (!projectId) throw new Error("Missing projectId");

            const payload = {
                projectId,
                towerId: towerId.trim(), // required
                propertyType: opt(propertyType),
                bedroom: opt(bedroom),
                sellPrice: opt(sellPrice),
                area: opt(area),
                builtUpArea: opt(builtUpArea),
                carpetArea: opt(carpetArea),
                otherArea: opt(otherArea),
                totalUnit: Number(totalUnit), // required (validated before submit)
            };

            return fetchJson<UnitConfig>(`/api/projects/${projectId}/unit-configs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "unit-configs"] });
            toast({ title: "Unit config created" });
            setCreateOpen(false);
            resetForm();
        },
        onError: (e: any) => {
            toast({
                title: "Error",
                description: e?.message || "Failed to create unit config",
                variant: "destructive",
            });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async () => {
            if (!editing) throw new Error("No unit config selected");

            const payload = {
                towerId: towerId.trim(), // required
                propertyType: opt(propertyType),
                bedroom: opt(bedroom),
                sellPrice: opt(sellPrice),
                area: opt(area),
                builtUpArea: opt(builtUpArea),
                carpetArea: opt(carpetArea),
                otherArea: opt(otherArea),
                totalUnit: Number(totalUnit), // required (validated before submit)
            };

            return fetchJson<UnitConfig>(`/api/project-unit-configs/${editing.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "unit-configs"] });
            toast({ title: "Unit config updated" });
            setEditOpen(false);
            setEditing(null);
            resetForm();
        },
        onError: (e: any) => {
            toast({
                title: "Error",
                description: e?.message || "Failed to update unit config",
                variant: "destructive",
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (configId: string) => {
            await fetchJson(`/api/project-unit-configs/${configId}`, { method: "DELETE" });
            return true;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "unit-configs"] });
            toast({ title: "Unit config deleted" });
        },
        onError: (e: any) => {
            toast({
                title: "Error",
                description: e?.message || "Failed to delete unit config",
                variant: "destructive",
            });
        },
    });

    const openEdit = (u: UnitConfig) => {
        setEditing(u);

        setTowerId(u.towerId || "");
        setPropertyType(u.propertyType || "");
        setBedroom(u.bedroom || "");
        setSellPrice(u.sellPrice || "");
        setArea(u.area || "");
        setBuiltUpArea(u.builtUpArea || "");
        setCarpetArea(u.carpetArea || "");
        setOtherArea(u.otherArea || "");
        setTotalUnit(String(u.totalUnit ?? ""));

        setEditOpen(true);
    };

    const doDelete = (u: UnitConfig) => {
        if (!confirm(`Delete this unit config?`)) return;
        deleteMutation.mutate(u.id);
    };

    const towerNameById = React.useMemo(() => {
        const map = new Map<string, string>();
        for (const t of towers) map.set(t.id, t.name || t.id);
        return map;
    }, [towers]);

    const canSubmit = towerId.trim() && totalUnit.trim();

    const renderFormFields = () => (
        <div className="grid gap-3">
            {/* 1) Tower dropdown (required) */}
            <div className="grid gap-1">
                <Label>
                    Tower <span className="text-destructive">*</span>
                </Label>
                <select
                    value={towerId}
                    onChange={(e) => setTowerId(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                    <option value="">Select tower</option>
                    {towers.map((t) => (
                        <option key={t.id} value={t.id}>
                            {t.name || t.id}
                        </option>
                    ))}
                </select>
            </div>

            <div className="grid gap-1">
                <Label>Property Type (optional)</Label>
                <Input value={propertyType} onChange={(e) => setPropertyType(e.target.value)} placeholder="e.g. Apartment" />
            </div>

            <div className="grid gap-1">
                <Label>Bedroom (optional)</Label>
                <Input value={bedroom} onChange={(e) => setBedroom(e.target.value)} placeholder="e.g. 2 / 2BHK / Studio" />
            </div>

            <div className="grid gap-1">
                <Label>Sell Price (optional)</Label>
                <Input value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} placeholder="e.g. 8500000" />
            </div>

            <div className="grid gap-1">
                <Label>Area (optional)</Label>
                <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. 1100 sq.ft" />
            </div>

            <div className="grid gap-1">
                <Label>Built Up Area (optional)</Label>
                <Input value={builtUpArea} onChange={(e) => setBuiltUpArea(e.target.value)} placeholder="e.g. 1200 sq.ft" />
            </div>

            <div className="grid gap-1">
                <Label>Carpet Area (optional)</Label>
                <Input value={carpetArea} onChange={(e) => setCarpetArea(e.target.value)} placeholder="e.g. 850 sq.ft" />
            </div>

            <div className="grid gap-1">
                <Label>Other Area (optional)</Label>
                <Input value={otherArea} onChange={(e) => setOtherArea(e.target.value)} placeholder="e.g. Balcony 60 sq.ft" />
            </div>

            <div className="grid gap-1">
                <Label>
                    Total Unit <span className="text-destructive">*</span>
                </Label>
                <Input value={totalUnit} onChange={(e) => setTotalUnit(e.target.value)} placeholder="e.g. 24" />
            </div>
        </div>
    );

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">Unit / Plan Configurations</h1>
                    <p className="text-sm text-muted-foreground">Manage unit types/plans for this project.</p>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setLocation("/projects")}>
                        Back
                    </Button>

                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2">
                                <Plus className="w-4 h-4" />
                                Add Unit Config
                            </Button>
                        </DialogTrigger>

                        <DialogContent className="max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Create Unit Config</DialogTitle>
                            </DialogHeader>

                            {renderFormFields()}

                            <div className="flex gap-2 justify-end pt-2">
                                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={() => createMutation.mutate()}
                                    disabled={!canSubmit || createMutation.isPending}
                                >
                                    {createMutation.isPending ? "Saving..." : "Create"}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Card className="rounded-xl">
                <CardContent className="p-4">
                    {isLoading ? (
                        <div className="text-sm text-muted-foreground">Loading...</div>
                    ) : items.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No unit configs found.</div>
                    ) : (
                        <div className="grid gap-3">
                            {items.map((u) => {
                                const towerName = u.towerId ? towerNameById.get(u.towerId) : null;

                                const line1 = [
                                    towerName ? `Tower: ${towerName}` : null,
                                    u.propertyType ? `Type: ${u.propertyType}` : null,
                                    u.bedroom ? `Bedroom: ${u.bedroom}` : null,
                                ]
                                    .filter(Boolean)
                                    .join(" • ");

                                const line2 = [
                                    u.sellPrice ? `Sell: ${u.sellPrice}` : null,
                                    u.area ? `Area: ${u.area}` : null,
                                    u.builtUpArea ? `BuiltUp: ${u.builtUpArea}` : null,
                                    u.carpetArea ? `Carpet: ${u.carpetArea}` : null,
                                    u.otherArea ? `Other: ${u.otherArea}` : null,
                                ]
                                    .filter(Boolean)
                                    .join(" • ");

                                return (
                                    <div
                                        key={u.id}
                                        className="flex items-start justify-between gap-3 rounded-lg border p-3 bg-background"
                                    >
                                        <div className="min-w-0">
                                            <div className="font-medium truncate">
                                                {line1 || "—"}
                                            </div>
                                            <div className="text-sm text-muted-foreground truncate">
                                                {line2 || "—"}
                                            </div>
                                            <div className="text-xs text-muted-foreground truncate">
                                                Total Unit: <span className="font-medium">{u.totalUnit || "—"}</span>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => doDelete(u)}
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

            <Dialog
                open={editOpen}
                onOpenChange={(v) => {
                    setEditOpen(v);
                    if (!v) {
                        setEditing(null);
                        resetForm();
                    }
                }}
            >
                <DialogContent className="max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Unit Config</DialogTitle>
                    </DialogHeader>

                    {!editing ? (
                        <div className="text-sm text-muted-foreground">Loading...</div>
                    ) : (
                        <>
                            {renderFormFields()}

                            <div className="flex gap-2 justify-end pt-2">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setEditOpen(false);
                                        setEditing(null);
                                        resetForm();
                                    }}
                                >
                                    Cancel
                                </Button>

                                <Button
                                    onClick={() => updateMutation.mutate()}
                                    disabled={!canSubmit || updateMutation.isPending}
                                >
                                    {updateMutation.isPending ? "Saving..." : "Update"}
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
