import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  DollarSign,
  Home,
  User,
  FileText,
  Download,
  FileDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Property, Owner } from "@shared/schema";
import { getDefaultPropertyImage } from "@/lib/defaultPropertyImages";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface PropertyDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: Property | null;
}

const statusColors: Record<string, string> = {
  Available: "bg-green-100 text-green-700 hover:bg-green-100",
  Sold: "bg-red-100 text-red-700 hover:bg-red-100",
  "Under Construction": "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
};

const typeColors: Record<string, string> = {
  Residential: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  Commercial: "bg-purple-100 text-purple-700 hover:bg-purple-100",
};

export function PropertyDetailDrawer({
  open,
  onOpenChange,
  property,
}: PropertyDetailDrawerProps) {
  const { data: owners } = useQuery<Owner[]>({
    queryKey: ["/api/owners"],
  });

  // Fetch documents for this property
  const { data: documents = [] } = useQuery<any[]>({
    queryKey: property?.id
      ? [`/api/documents?entityType=property&entityId=${property.id}`]
      : ["/api/documents"],
    enabled: !!property?.id,
  });

  // 🖼 Fetch images on-demand when drawer opens (only for this property)
  const { data: propertyImages = {} } = useQuery<Record<string, string[]>>({
    queryKey: property?.id ? ["property-images", property.id] : ["property-images"],
    queryFn: async () => {
      if (!property?.id) return {};
      const res = await fetch(
        `/api/properties/images?ids=${encodeURIComponent(property.id)}`
      );
      if (!res.ok) return {};
      return res.json();
    },
    enabled: !!property?.id && open,
  });

  const owner = owners?.find((o) => o.id === property?.ownerId);

  const handleDownload = async (docId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/documents/${docId}/download`);
      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || "document.pdf";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download error:", error);
    }
  };

  const handleDownloadBrochure = async () => {
    if (!property?.id) return;

    try {
      const response = await fetch(`/api/pdf/property/${property.id}`);
      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `property-${property.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download brochure error:", error);
    }
  };

  const buildGoogleMapHref = (raw: string) => {
    const value = raw.trim();
    const coordPattern = /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/;

    if (coordPattern.test(value)) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        value
      )}`;
    }

    if (/^https?:\/\//i.test(value)) {
      return value;
    }

    return `https://${value}`;
  };


  // -------------------- 🖼 Image carousel state --------------------
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);

  // 🔁 Mutation: Set current image as cover
  const setCoverImageMutation = useMutation({
    mutationFn: async (index: number) => {
      if (!property) throw new Error("No property selected");
      await apiRequest(
        "PATCH",
        `/api/properties/${property.id}/cover-image`,
        { index }
      );
    },
    onSuccess: () => {
      // Refresh properties list so cards show the new cover image
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
    },
    onError: (error: any) => {
      console.error("Failed to set cover image:", error);
      alert("Failed to set cover image. Please try again.");
    },
  });

  const handleSetCoverImage = () => {
    if (!property) return;
    setCoverImageMutation.mutate(currentImageIndex);
  };


  // Reset to first image whenever property changes
  useEffect(() => {
    setCurrentImageIndex(0);
    setIsImageViewerOpen(false);
  }, [property?.id]);

  if (!property) return null;

  // Build a safe images array (use fetched images, fallback to property.images, then default)
  const images: string[] =
    (propertyImages[property.id] && propertyImages[property.id].length > 0)
      ? propertyImages[property.id]
      : (property.images && property.images.length > 0)
        ? property.images
        : [getDefaultPropertyImage(property.type)];

  const totalImages = images.length;
  const showArrows = totalImages > 1;

  const goPrev = () => {
    if (!showArrows) return;
    setCurrentImageIndex((prev) => (prev - 1 + totalImages) % totalImages);
  };

  const goNext = () => {
    if (!showArrows) return;
    setCurrentImageIndex((prev) => (prev + 1) % totalImages);
  };

  // ----------------------------------------------------------------

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center justify-between gap-4">
              <SheetTitle className="text-2xl flex-1">
                {property.title}
              </SheetTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadBrochure}
                data-testid="button-download-brochure"
              >
                <FileDown className="w-4 h-4 mr-2" />
                Brochure
              </Button>
            </div>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Property Images Carousel (click to zoom) */}
            <div
              className="relative h-56 rounded-lg overflow-hidden bg-muted cursor-zoom-in"
              onClick={() => setIsImageViewerOpen(true)}
            >
              <img
                src={images[currentImageIndex]}
                alt={property.title ?? "Property Image"}
                className="w-full h-full object-cover"
              />

              {showArrows && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation(); // don't open zoom
                      goPrev();
                    }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation(); // don't open zoom
                      goNext();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}

              {/* small "1 / N" indicator */}
              {totalImages > 1 && (
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                  {currentImageIndex + 1} / {totalImages}
                </div>
              )}
            </div>

            {/* Status and Type Badges */}
            <div className="flex gap-2">
              {property.status && (
                <Badge className={statusColors[property.status]}>
                  {property.status}
                </Badge>
              )}
              {property.type && (
                <Badge className={typeColors[property.type]}>
                  {property.type}
                </Badge>
              )}
            </div>
            {/* Property Details */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase">
                Property Details
              </h3>

              <div className="space-y-2">

                {/* Price */}
                {property.price && (
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">₹{property.price}</span>
                  </div>
                )}

                {/* Area */}
                {property.area && (
                  <div className="flex items-center gap-3">
                    <Home className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      {property.area.toLocaleString()} sqft
                    </span>
                  </div>
                )}

                {/* 📍 Location + Google Map Link */}
                {(property.location || property.googleMapLink) && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />

                    <div className="flex flex-col">

                      {/* Location → route from current location */}
                      {property.location && (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                            property.location
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          {property.location}
                        </a>
                      )}

                      {/* Google Map Link → opens saved exact URL */}
                      {property.googleMapLink && (
                        <a
                          href={buildGoogleMapHref(property.googleMapLink)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          Google map link
                        </a>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>

            <Separator />


            {/* Owner Information */}
            {owner && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase">
                    Owner Information
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{owner.name}</span>
                    </div>
                    {owner.phone && (
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                          Phone:
                        </span>
                        <span className="text-sm">{owner.phone}</span>
                      </div>
                    )}
                    {owner.email && (
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                          Email:
                        </span>
                        <span className="text-sm">{owner.email}</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Description */}
            {property.description && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase">
                    Description
                  </h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {property.description}
                  </p>
                </div>
              </>
            )}

            {/* Documents */}
            <Separator />
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase">
                Documents
              </h3>
              {documents.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No documents attached</p>
                  <p className="text-xs mt-1">
                    Upload documents in the Document Library tab
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc: any) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover-elevate"
                      data-testid={`document-${doc.id}`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {doc.title}
                          </p>
                          {doc.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {doc.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleDownload(doc.id, doc.fileName)
                        }
                        data-testid={`button-download-doc-${doc.id}`}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* 🔍 Full-size image viewer */}
      <Dialog
        open={isImageViewerOpen}
        onOpenChange={setIsImageViewerOpen}
      >
        <DialogContent
          className="
    w-full 
    max-w-[96vw]        /* use almost full viewport width */
    p-0 
    bg-black 
    border-none 
    max-h-[96vh]        /* allow dialog itself to grow taller */
  "
        >
          <div className="relative w-full flex justify-center items-center">
            <img
              src={images[currentImageIndex]}
              alt={property.title ?? "Property Image"}
              className=" w-full h-auto max-h-[90vh]     /* taller image than before (was 80vh) */object-contain"
              loading="lazy"
            />

            {/* ⭐ Set as cover image button */}
            {totalImages > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSetCoverImage();
                }}
                disabled={setCoverImageMutation.isPending}
                className="absolute top-4 left-4 bg-white/90 text-sm px-3 py-1 rounded-md shadow hover:bg-white disabled:opacity-70"
              >
                {setCoverImageMutation.isPending ? "Saving..." : "Set as cover image"}
              </button>

            )}


            {showArrows && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goPrev();
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/60 text-white rounded-full p-2 hover:bg-black/80"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goNext();
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/60 text-white rounded-full p-2 hover:bg-black/80"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            {totalImages > 1 && (
              <div className="absolute bottom-4 right-4 bg-black/70 text-white text-xs px-3 py-1 rounded-full">
                {currentImageIndex + 1} / {totalImages}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
