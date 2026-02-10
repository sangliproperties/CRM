import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getQueryFn } from "@/lib/queryClient";
import { Plus, Search, Edit, Trash2, Phone, Mail } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { OwnerFormDialog } from "@/components/owner-form-dialog";
import type { Owner } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function Owners() {
  const { toast } = useToast();
  const [location] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.split("?")[1] || "");
    const searchFromUrl = params.get("search") || "";

    setSearchTerm(searchFromUrl);
  }, [location]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = (params.get("search") || "").trim();

    // only set if query exists; prevents wiping user typing on normal visits
    if (q) setSearchTerm(q);
  }, [location]);


  console.log("Owners URL:", window.location.href);
  console.log("Owners searchTerm:", searchTerm);

  const { data: owners, isLoading } = useQuery<Owner[]>({
    queryKey: ["/api/owners"],
    queryFn: getQueryFn({ on401: "returnNull" }), // ✅ Correct usage
  });


  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/owners/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owners"] });
      toast({
        title: "Success",
        description: "Owner deleted successfully",
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
        description: "Failed to delete owner",
        variant: "destructive",
      });
    },
  });

  const filteredOwners = owners?.filter(owner => {
    const matchesSearch = owner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      owner.phone.includes(searchTerm) ||
      owner.email?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  }) || [];

  const handleEdit = (owner: Owner) => {
    setSelectedOwner(owner);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this owner?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Property Owners</h1>
          <p className="text-muted-foreground">Manage property owner information</p>
        </div>
        <Button
          className="bg-gold hover:bg-gold/90 text-gold-foreground"
          onClick={() => {
            setSelectedOwner(null);
            setIsFormOpen(true);
          }}
          data-testid="button-add-owner"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Owner
        </Button>
      </div>

      <Card className="border border-card-border">
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-owners"
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
          ) : filteredOwners.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No owners found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOwners.map((owner) => (
                    <TableRow key={owner.id} className="hover-elevate" data-testid={`owner-row-${owner.id}`}>
                      <TableCell className="font-medium">{owner.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          {owner.phone}
                        </div>
                      </TableCell>
                      <TableCell>
                        {owner.email ? (
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-muted-foreground" />
                            {owner.email}
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{owner.address || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEdit(owner)}
                            data-testid={`button-edit-${owner.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(owner.id)}
                            data-testid={`button-delete-${owner.id}`}
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

      <OwnerFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        owner={selectedOwner}
      />
    </div>
  );
}
