import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Search,
  Grid3x3,
  Table as TableIcon,
  Edit,
  Trash2,
  MapPin,
  User,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
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
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PropertyFormDialog } from "@/components/property-form-dialog";
import { PropertyDetailDrawer } from "@/components/property-detail-drawer";
import type { Property, PropertyWithOwner } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { isUnauthorizedError } from "@/lib/authUtils";
import { getDefaultPropertyImage } from "@/lib/defaultPropertyImages";
import WorldMapBg from "@/components/world-map-bg";

const statusColors: Record<string, string> = {
  Available: "bg-green-100 text-green-700 hover:bg-green-100",
  Sold: "bg-red-100 text-red-700 hover:bg-red-100",
  "Under Construction": "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
};

const furnishingStatusColors: Record<string, string> = {
  Furnished: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  "Semi-furnished": "bg-blue-100 text-blue-700 hover:bg-blue-100",
  Unfurnished: "bg-slate-100 text-slate-700 hover:bg-slate-100",
};

// Response shape from /api/properties
type PropertyListResponse =
  | PropertyWithOwner[]
  | {
    items: PropertyWithOwner[];
    page: number;
    pageSize: number;
    total?: number; // ✅ IMPORTANT for pagination
  };

export default function Properties() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const debounceDelay = 350;
  const minSearchLength = 2;

  useEffect(() => {
    const id = setTimeout(() => {
      if (searchTerm.trim().length >= minSearchLength) {
        setDebouncedSearchTerm(searchTerm.trim());
      } else {
        setDebouncedSearchTerm("");
      }
    }, debounceDelay);

    return () => clearTimeout(id);
  }, [searchTerm, debounceDelay, minSearchLength]);

  const [transactionTypeFilter, setTransactionTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [casteFilter, setCasteFilter] = useState<string>("all"); // ✅ ADD
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailProperty, setDetailProperty] = useState<Property | null>(null);
  const [imagesById, setImagesById] = useState<Record<string, string[]>>({});
  const [currentImageIndexById, setCurrentImageIndexById] = useState<Record<string, number>>({});

  // pagination state
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // search mode (>=2 chars)
  const hasSearch = debouncedSearchTerm.trim().length >= minSearchLength;

  // server query page/pageSize:
  // - In search mode: load a big chunk once, and paginate on client
  // - In normal mode: real server pagination
  const effectivePage = hasSearch ? 1 : page;
  const effectivePageSize = hasSearch ? 5000 : pageSize;

  // reset to page 1 when search term or filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm, transactionTypeFilter, statusFilter, casteFilter]);

  const {
    data: propertiesResponse,
    isLoading,
    isFetching,
    error,
  } = useQuery<PropertyListResponse>({
    queryKey: [
      "properties",
      effectivePage,
      effectivePageSize,
      hasSearch ? debouncedSearchTerm : "",
      transactionTypeFilter,
      statusFilter,
      casteFilter, // ✅ ADD
    ],
    queryFn: async () => {
      const url =
        `/api/properties?page=${effectivePage}&pageSize=${effectivePageSize}` +
        `&search=${encodeURIComponent(hasSearch ? debouncedSearchTerm : "")}` +
        `&transactionType=${encodeURIComponent(transactionTypeFilter)}` +
        `&status=${encodeURIComponent(statusFilter)}` +
        `&caste=${encodeURIComponent(casteFilter)}`; // ✅ ADD

      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Failed to load properties (${res.status}): ${text}`);
      }
      return res.json();
    },
    staleTime: 10_000,
  });

  // normalize the response so we always get an array
  const properties: PropertyWithOwner[] = Array.isArray(propertiesResponse)
    ? propertiesResponse
    : Array.isArray((propertiesResponse as any)?.items)
      ? (propertiesResponse as any).items
      : [];

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/properties/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      toast({
        title: "Success",
        description: "Property deleted successfully",
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
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to delete property",
        variant: "destructive",
      });
    },
  });

  // Memoize filtering
  const filteredProperties = useMemo(() => {
    const list: PropertyWithOwner[] = Array.isArray(properties) ? properties : [];
    const query = (debouncedSearchTerm || "").toLowerCase().trim();

    return list.filter((property) => {
      const matchesSearch =
        query === "" ||
        (property.codeNo?.toLowerCase().includes(query) ?? false) ||   // ✅ NEW: search by codeNo
        (property.title?.toLowerCase().includes(query) ?? false) ||
        (property.location?.toLowerCase().includes(query) ?? false) ||
        (property.type?.toLowerCase().includes(query) ?? false) ||
        (property.area?.toString().toLowerCase().includes(query) ?? false) ||
        (property.builtUpArea?.toString().toLowerCase().includes(query) ?? false) ||
        (property.ownerName?.toLowerCase().includes(query) ?? false) ||
        (property.ownerPhone?.toString().toLowerCase().includes(query) ?? false);

      const matchesTransactionType =
        transactionTypeFilter === "all" || property.transactionType === transactionTypeFilter;

      const matchesStatus = statusFilter === "all" || property.status === statusFilter;

      const matchesCaste =
        casteFilter === "all" || property.caste === casteFilter; // ✅ ADD

      return matchesSearch && matchesTransactionType && matchesStatus && matchesCaste;
    });
  }, [properties, debouncedSearchTerm, transactionTypeFilter, statusFilter, casteFilter]);

  // ✅ TOTAL COUNT FOR PAGINATION
  // - Search mode: total = filteredProperties.length (client-side list)
  // - Normal mode: total = API response total (server-side)
  const totalCount = hasSearch
    ? filteredProperties.length
    : (Array.isArray(propertiesResponse) ? properties.length : (propertiesResponse as any)?.total) ?? properties.length;

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // ✅ What to render on screen:
  // - Search mode: paginate locally
  // - Normal mode: server already returned just the pageSize items
  const visibleProperties = hasSearch
    ? filteredProperties.slice((page - 1) * pageSize, page * pageSize)
    : filteredProperties;

  useEffect(() => {
    // only fetch images for currently visible properties
    const ids = visibleProperties.map((p) => p.id).filter(Boolean);
    if (ids.length === 0) return;

    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(
          `/api/properties/images?ids=${encodeURIComponent(ids.join(","))}`,
          { signal: controller.signal }
        );
        if (!res.ok) return;

        const data = await res.json();
        setImagesById(data || {});
      } catch {
        // ignore abort errors
      }
    })();

    return () => controller.abort();
  }, [visibleProperties]);

  const handleEdit = (property: Property) => {
    const images = imagesById[property.id] || [];

    setSelectedProperty({
      ...property,
      images, // ✅ attach already-loaded images
    } as any);

    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this property?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleViewDetails = (property: Property) => {
    setDetailProperty(property);
    setIsDetailOpen(true);
  };

  const buildGoogleMapHref = (raw: string) => {
    const value = raw.trim();
    const coordPattern = /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/;

    if (coordPattern.test(value)) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`;
    }
    if (/^https?:\/\//i.test(value)) return value;
    return `https://${value}`;
  };

  const getImagesForProperty = (property: PropertyWithOwner): string[] => {
    const loaded = imagesById[property.id];
    const cleaned = Array.isArray(loaded)
      ? loaded.filter((img) => typeof img === "string" && img.trim().length > 0)
      : [];

    if (cleaned.length > 0) return cleaned;
    return [getDefaultPropertyImage(property.type)];
  };

  const goPrevImage = (propertyId: string, total: number) => {
    setCurrentImageIndexById((prev) => {
      const current = prev[propertyId] ?? 0;
      return { ...prev, [propertyId]: (current - 1 + total) % total };
    });
  };

  const goNextImage = (propertyId: string, total: number) => {
    setCurrentImageIndexById((prev) => {
      const current = prev[propertyId] ?? 0;
      return { ...prev, [propertyId]: (current + 1) % total };
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Properties</h1>
          <p className="text-muted-foreground">Manage your property listings</p>
        </div>

        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            Total Property :{" "}
            <span className="font-semibold text-foreground">{totalCount}</span>
          </p>

          <Button
            className="bg-gold hover:bg-gold/90 text-gold-foreground"
            onClick={() => {
              setSelectedProperty(null);
              setIsFormOpen(true);
            }}
            data-testid="button-add-property"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Property
          </Button>
        </div>
      </div>

      <Card className="relative overflow-hidden">
        <WorldMapBg imageUrl="/world-map.jpg" opacity={0.30} maxShiftPx={60} />
        <CardHeader>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by Code No, Title, Location, Category, Owner Name, Phone or Area..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (e.target.value.trim().length > 0) setPage(1);
                }}
                className="pl-10"
                data-testid="input-search-properties"
              />
            </div>

            <Select value={transactionTypeFilter} onValueChange={setTransactionTypeFilter}>
              <SelectTrigger className="w-full lg:w-[180px]" data-testid="select-transaction-filter">
                <SelectValue placeholder="Transaction type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Transactions</SelectItem>
                <SelectItem value="Buy">Buy</SelectItem>
                <SelectItem value="Sell">Sell</SelectItem>
                <SelectItem value="Rent">Rent</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-[180px]" data-testid="select-status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Available">Available</SelectItem>
                <SelectItem value="Sold">Sold</SelectItem>
                <SelectItem value="Under Construction">Under Construction</SelectItem>
                <SelectItem value="Hold">Hold</SelectItem>
                <SelectItem value="Rented">Rented</SelectItem>
              </SelectContent>
            </Select>

            <Select value={casteFilter} onValueChange={setCasteFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Caste" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem> {/* optional but recommended */}
                <SelectItem value="All Caste">All Caste</SelectItem>
                <SelectItem value="Restricted">Restricted</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("grid")}
                data-testid="button-grid-view"
              >
                <Grid3x3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("table")}
                data-testid="button-table-view"
              >
                <TableIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-80 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            )
          ) : visibleProperties.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No properties found</p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleProperties.map((property) => {
                const images = getImagesForProperty(property);
                const totalImages = images.length;
                const currentIndex = currentImageIndexById[property.id] ?? 0;

                return (
                  <Card
                    key={property.id}
                    className="group overflow-hidden hover-elevate border border-card-border cursor-pointer"
                    data-testid={`property-card-${property.id}`}
                    onClick={() => handleViewDetails(property)}
                  >
                    <div className="relative aspect-[5/6] bg-muted">
                      <img
                        src={images[currentIndex]}
                        alt={property.title ?? "Property Image"}
                        className="w-full h-full object-contain transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                        loading="lazy"
                      />

                      {totalImages > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              goPrevImage(property.id, totalImages);
                            }}
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              goNextImage(property.id, totalImages);
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                            {currentIndex + 1} / {totalImages}
                          </div>
                        </>
                      )}

                      {property.furnishingStatus && (
                        <div className="absolute top-3 left-3">
                          <Badge
                            className={
                              furnishingStatusColors[property.furnishingStatus] ??
                              "bg-slate-100 text-slate-700"
                            }
                          >
                            {property.furnishingStatus}
                          </Badge>
                        </div>
                      )}

                      <div className="absolute top-3 right-3">
                        <Badge className={statusColors[property.status]}>
                          {property.status}
                        </Badge>
                      </div>
                    </div>

                    <CardContent className="relative z-10">
                      <h3 className="font-semibold text-lg mb-2">{property.title}</h3>

                      {property.codeNo ? (
                        <div className="text-lg font-bold text-red-600">
                          {property.codeNo}
                        </div>
                      ) : null}

                      <div className="space-y-2 mb-4">
                        {(property.location || property.googleMapLink) && (
                          <div className="flex items-start gap-2 text-sm text-muted-foreground">
                            <MapPin className="w-4 h-4 mt-0.5" />
                            <div className="flex flex-col">
                              {property.location && (
                                <a
                                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                                    property.location
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="hover:underline cursor-pointer"
                                >
                                  {property.location}
                                </a>
                              )}

                              {property.googleMapLink && (
                                <a
                                  href={buildGoogleMapHref(property.googleMapLink)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-primary text-xs hover:underline cursor-pointer"
                                >
                                  Google map link
                                </a>
                              )}
                            </div>
                          </div>
                        )}

                        {property.ownerName && (
                          <Link
                            href={`/owners?search=${encodeURIComponent(property.ownerName)}`}
                          >
                            <div
                              className="flex items-center gap-2 text-sm text-primary hover:underline cursor-pointer"
                              onClick={(e) => e.stopPropagation()}
                              data-testid={`owner-link-${property.id}`}
                            >
                              <User className="w-4 h-4" />
                              {property.ownerName}
                            </div>
                          </Link>
                        )}

                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">{property.type}</Badge>
                          {property.transactionType && (
                            <Badge variant="secondary">{property.transactionType}</Badge>
                          )}
                          <span className="text-sm text-muted-foreground">{property.area} sqft</span>
                          {property.builtUpArea && (
                            <span className="text-sm text-muted-foreground">
                              · Built Up: {property.builtUpArea} sqft
                            </span>
                          )}
                        </div>

                        <div className="text-xl font-bold text-primary">
                          {property.price ? `₹${property.price}` : "₹-"}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(property);
                          }}
                          data-testid={`button-edit-${property.id}`}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(property.id);
                          }}
                          data-testid={`button-delete-${property.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Transaction</TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleProperties.map((property) => (
                    <TableRow
                      key={property.id}
                      className="hover-elevate cursor-pointer"
                      data-testid={`property-row-${property.id}`}
                      onClick={() => handleViewDetails(property)}
                    >
                      <TableCell className="font-medium">{property.title}</TableCell>

                      <TableCell>
                        {property.location ? (
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                              property.location
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-primary hover:underline"
                          >
                            {property.location}
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>

                      <TableCell>
                        {property.ownerName ? (
                          <Link
                            href={`/owners?search=${encodeURIComponent(property.ownerName)}`}
                          >
                            <span
                              className="text-primary hover:underline cursor-pointer flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                              data-testid={`owner-link-table-${property.id}`}
                            >
                              <User className="w-3 h-3" />
                              {property.ownerName}
                            </span>
                          </Link>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline">{property.type}</Badge>
                      </TableCell>

                      <TableCell>
                        {property.transactionType ? (
                          <Badge variant="secondary">{property.transactionType}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>

                      <TableCell>
                        {property.area} sqft
                        {property.builtUpArea && (
                          <div className="text-xs text-muted-foreground">
                            Built Up: {property.builtUpArea} sqft
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="font-semibold">
                        ₹{Number(property.price).toLocaleString()}
                      </TableCell>

                      <TableCell>
                        <Badge className={statusColors[property.status]}>{property.status}</Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(property);
                            }}
                            data-testid={`button-edit-${property.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(property.id);
                            }}
                            data-testid={`button-delete-${property.id}`}
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

          {/* ✅ Pagination (works in both modes) */}
          {totalCount > pageSize && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1 || isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>

              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages} ({totalCount} total)
              </span>

              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || isFetching}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <PropertyFormDialog open={isFormOpen} onOpenChange={setIsFormOpen} property={selectedProperty} />

      <PropertyDetailDrawer open={isDetailOpen} onOpenChange={setIsDetailOpen} property={detailProperty} />
    </div>
  );
}
