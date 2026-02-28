import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getQueryFn, queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Search, Edit, Trash2, Building2, MapPin } from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { isUnauthorizedError } from "@/lib/authUtils";
import { ApartmentFormDialog } from "@/components/apartment-form-dialog";
import type { Apartment } from "@shared/schema";

export default function Apartments() {
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState("");
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedApartment, setSelectedApartment] = useState<Apartment | null>(
        null
    );

    const { data: apartments, isLoading } = useQuery<Apartment[]>({
        queryKey: ["/api/apartments"],
        queryFn: getQueryFn({ on401: "returnNull" }),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await apiRequest("DELETE", `/api/apartments/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/apartments"] });
            toast({
                title: "Success",
                description: "Apartment deleted successfully",
            });
        },
        onError: (error: Error) => {
            if (isUnauthorizedError(error)) {
                toast({
                    title: "Unauthorized",
                    description: "You are logged out. Logging in again...",
                    variant: "destructive",
                });
                setTimeout(() => {
                    window.location.href = "/login";
                }, 500);
                return;
            }

            toast({
                title: "Error",
                description: "Failed to delete apartment",
                variant: "destructive",
            });
        },
    });

    const filteredApartments =
        apartments?.filter((apt) => {
            const term = searchTerm.trim().toLowerCase();
            if (!term) return true;

            const name = (apt.name || "").toLowerCase();
            const address = (apt.address || "").toLowerCase();

            return name.includes(term) || address.includes(term);
        }) || [];

    const handleEdit = (apt: Apartment) => {
        setSelectedApartment(apt);
        setIsFormOpen(true);
    };

    const handleDelete = (id: string) => {
        if (confirm("Are you sure you want to delete this apartment?")) {
            deleteMutation.mutate(id);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Apartments</h1>
                    <p className="text-muted-foreground">
                        Manage apartment names and addresses
                    </p>
                </div>

                <Button
                    className="bg-gold hover:bg-gold/90 text-gold-foreground"
                    onClick={() => {
                        setSelectedApartment(null);
                        setIsFormOpen(true);
                    }}
                    data-testid="button-add-apartment"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Apartment
                </Button>
            </div>

            <Card className="border border-card-border">
                <CardHeader>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by apartment name or address..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                            data-testid="input-search-apartments"
                        />
                    </div>
                </CardHeader>

                <CardContent>
                    {isLoading ? (
                        <div className="space-y-3">
                            {[...Array(5)].map((_, i) => (
                                <Skeleton key={i} className="h-16 w-full" />
                            ))}
                        </div>
                    ) : filteredApartments.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground">No apartments found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Apartment Name</TableHead>
                                        <TableHead>Apartment Address</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {filteredApartments.map((apt) => (
                                        <TableRow
                                            key={apt.id}
                                            className="hover-elevate"
                                            data-testid={`apartment-row-${apt.id}`}
                                        >
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="w-4 h-4 text-muted-foreground" />
                                                    {apt.name}
                                                </div>
                                            </TableCell>

                                            <TableCell className="max-w-xl truncate">
                                                {apt.address ? (
                                                    <div className="flex items-center gap-2">
                                                        <MapPin className="w-4 h-4 text-muted-foreground" />
                                                        {apt.address}
                                                    </div>
                                                ) : (
                                                    "-"
                                                )}
                                            </TableCell>

                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => handleEdit(apt)}
                                                        data-testid={`button-edit-${apt.id}`}
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </Button>

                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => handleDelete(apt.id)}
                                                        data-testid={`button-delete-${apt.id}`}
                                                    >
                                                        <Trash2 className="w-4 h-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <ApartmentFormDialog
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                apartment={selectedApartment}
            />
        </div>
    );
}