import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Property, Owner } from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";

// Add this import or type definition for DocumentAttachment
export type DocumentAttachment = {
  id: string;
  title: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  entityType: string;
  entityId: string;
  createdAt?: string;
  updatedAt?: string;
};

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  insertPropertySchema,
  furnishingStatusValues,
  propertyFacingValues,
} from "@shared/schema";

// ⬇️ NEW: table + icons for the docs list
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, Download, Trash2 } from "lucide-react";


/**
 * Base schema from DB:
 *  - images is already string[]
 *  - we override price & area to be string in the form
 */
const formSchema = insertPropertySchema.extend({
  price: z.string().optional(),
  area: z.string().optional(),

  // Represent dates as strings in the form (YYYY-MM-DD)
  agreementStartDate: z.string().optional().nullable(),
  agreementEndDate: z.string().optional().nullable(),
  // ✅ ADD THIS LINE
  constructionYear: z.string().optional().nullable(),
  // Optional messages handled as plain strings in form
  officeMessage: z.string().optional().nullable(),
  ownerMessage: z.string().optional().nullable(),

  // Google Maps link as a simple string
  googleMapLink: z.string().optional().nullable(),

  // Built up area (form as string)
  builtUpArea: z.string().optional(),
  // 🔹 NEW – keep as string in the form too
  furnishingStatus: z.enum(furnishingStatusValues).optional().nullable(),
  // ⭐ NEW
  locationPriority: z.string().optional().nullable(),
  propertyFacing: z.enum(propertyFacingValues).optional().nullable(),
  bedrooms: z.string().optional().nullable(),
  bathrooms: z.string().optional().nullable(),
  balconies: z.string().optional().nullable(),
  halls: z.string().optional().nullable(),

});

interface PropertyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property?: Property | null;
}

export function PropertyFormDialog({
  open,
  onOpenChange,
  property,
}: PropertyFormDialogProps) {
  const { toast } = useToast();

  const { data: owners } = useQuery<Owner[]>({
    queryKey: ["/api/owners"],
  });

  const [messageTarget, setMessageTarget] = useState<"office" | "owner" | "">(
    "",
  );
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [ownerSearch, setOwnerSearch] = useState("");
  // 🔹 Document upload state (for PDFs)
  const [docTitle, setDocTitle] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);

  // client/src/components/property-form-dialog.tsx

  // around line ~140
  const getViewUrl = (doc: DocumentAttachment) => {
    const apiView = `${window.location.origin}/api/documents/${doc.id}/view`;
    const apiDownload = `${window.location.origin}/api/documents/${doc.id}/download`;

    const type = (doc.mimeType || "").toLowerCase();
    const name = (doc.fileName || "").toLowerCase();

    const isPdf = type === "application/pdf" || name.endsWith(".pdf");
    if (isPdf) return apiView;

    const isPpt =
      type === "application/vnd.ms-powerpoint" ||
      type === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
      name.endsWith(".ppt") ||
      name.endsWith(".pptx");

    // ✅ Option A: PPT/PPTX “View” = Download
    if (isPpt) return apiDownload;

    // fallback for other types
    return apiView;
  };



  // 👉 Load existing PDF documents for this property (only when editing)
  const {
    data: propertyDocuments = [],
    isLoading: docsLoading,
    refetch: refetchDocuments,
  } = useQuery<DocumentAttachment[]>({
    queryKey: ["property-documents", property?.id],
    enabled: !!property?.id, // only when editing an existing property
    queryFn: async () => {
      if (!property?.id) return [];
      const res = await apiRequest(
        "GET",
        `/api/documents?entityType=property&entityId=${property.id}`,
      );
      return res.json();
    },
  });



  // Local previews (data URLs)
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      location: "",
      googleMapLink: "",
      price: "",
      area: "",
      builtUpArea: "",
      // 🔹 NEW
      floor: "",
      constructionYear: "",
      type: "",
      transactionType: undefined,
      status: "Available",
      // 🔹 NEW
      furnishingStatus: undefined,
      carpetArea: "",
      totalFloor: "",
      ownerId: undefined,
      locationPriority: undefined,   // ⭐ new
      agreementStartDate: "",
      agreementEndDate: "",
      lift: undefined, // no preselected value
      parking: undefined, // no preselected value
      images: [],
      description: "",
      officeMessage: "",
      ownerMessage: "",
      propertyFacing: undefined,
      bedrooms: "",
      bathrooms: "",
      balconies: "",
      halls: "",
      codeNo: undefined,
      caste: undefined,

    },
  });

  const transactionType = form.watch("transactionType");

  // Whenever type is not Rent, clear the agreement dates
  useEffect(() => {
    if (transactionType !== "Rent") {
      form.setValue("agreementStartDate", "");
      form.setValue("agreementEndDate", "");
    }
  }, [transactionType, form]);

  // Keep owner search label in sync
  useEffect(() => {
    if (!open) return;
    const currentOwnerId = form.getValues("ownerId");
    const currentOwner = owners?.find((o) => o.id === currentOwnerId);
    setOwnerSearch(
      currentOwner
        ? `${currentOwner.name}${currentOwner.phone ? ` (${currentOwner.phone})` : ""
        }`
        : "",
    );
  }, [open, owners, form]);

  // Populate form when editing / reset when adding new
  useEffect(() => {
    if (property) {
      const images = property.images ?? [];
      const officeMessage = property.officeMessage ?? "";
      const ownerMessage = property.ownerMessage ?? "";

      form.reset({
        title: property.title ?? "",
        location: property.location ?? "",
        googleMapLink: property.googleMapLink ?? "",
        price: property.price?.toString() ?? "",
        area: property.area?.toString() ?? "",
        builtUpArea: property.builtUpArea?.toString() ?? "",
        // 🔹 NEW
        floor: (property as any).floor ?? "",
        constructionYear: (property as any).constructionYear ?? "",
        carpetArea: (property as any).carpetArea ?? "",
        totalFloor: (property as any).totalFloor ?? "",
        // 🔹 NEW
        furnishingStatus: (property as any).furnishingStatus ?? undefined,
        type: property.type ?? "",
        transactionType: property.transactionType ?? undefined,
        status: property.status ?? "Available",
        ownerId: property.ownerId ?? undefined,
        agreementStartDate: property.agreementStartDate
          ? new Date(property.agreementStartDate as any)
            .toISOString()
            .slice(0, 10)
          : "",
        agreementEndDate: property.agreementEndDate
          ? new Date(property.agreementEndDate as any)
            .toISOString()
            .slice(0, 10)
          : "",

        // may be null in DB; fall back to undefined to keep Select empty
        lift: (property as any).lift ?? undefined,
        parking: (property as any).parking ?? undefined,
        locationPriority: (property as any).locationPriority ?? undefined, // ⭐
        propertyFacing: (property as any).propertyFacing ?? undefined,
        bedrooms: (property as any).bedrooms ?? "",
        bathrooms: (property as any).bathrooms ?? "",
        balconies: (property as any).balconies ?? "",
        halls: (property as any).halls ?? "",

        images,
        description: property.description ?? "",
        officeMessage,
        ownerMessage,
        codeNo: property.codeNo ?? "",
        caste:
          property.caste === "All Caste" || property.caste === "Restricted"
            ? property.caste
            : undefined,
      });

      // Pre-select radio based on existing message
      if (officeMessage) {
        setMessageTarget("office");
      } else if (ownerMessage) {
        setMessageTarget("owner");
      } else {
        setMessageTarget("");
      }

      setImagePreviews(images);
    } else {
      form.reset({
        title: "",
        location: "",
        googleMapLink: "",
        price: "",
        area: "",
        builtUpArea: "",
        floor: "",
        constructionYear: "",
        type: "",
        transactionType: undefined,
        status: "Available",
        // 🔹 NEW
        furnishingStatus: undefined,
        ownerId: undefined,
        locationPriority: undefined,   // ⭐
        agreementStartDate: "",
        agreementEndDate: "",
        lift: undefined,
        parking: undefined,
        images: [],
        description: "",
        officeMessage: "",
        ownerMessage: "",
      });
      setImagePreviews([]);
      setMessageTarget("");
    }
  }, [property, form]);

  /**
   * Convert selected files to DATA URLs (not blob: URLs),
   * then store them in the form's `images` array.
   */
  const handleImageChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const readFileAsDataUrl = (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

    try {
      const dataUrls = await Promise.all(files.map(readFileAsDataUrl));

      const existing = form.getValues("images") || [];
      const allImages = [...existing, ...dataUrls];

      form.setValue("images", allImages);
      setImagePreviews(allImages);
    } catch (err) {
      console.error("Image read error:", err);
      toast({
        title: "Error",
        description: "Failed to read selected images.",
        variant: "destructive",
      });
    } finally {
      // allow re-selecting same files if needed
      event.target.value = "";
    }
  };

  const removeImageAt = (index: number) => {
    const current = form.getValues("images") || [];
    const next = current.filter((_, i) => i !== index);
    form.setValue("images", next);
    setImagePreviews(next);
  };

  // 🔼 Upload a PDF/PPTX for this property
  const uploadDocument = async () => {
    if (!property?.id) {
      toast({
        title: "Property not saved yet",
        description:
          "Please save the property first, then you can upload documents.",
        variant: "destructive",
      });
      return;
    }

    if (!docTitle.trim() || !docFile) {
      toast({
        title: "Missing data",
        description: "Please enter a document title and choose a file.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Step 1: get an upload URL (local proxy or S3)
      const uploadUrlRes = await fetch(
        `/api/documents/upload-url?fileName=${encodeURIComponent(docFile.name)}&mimeType=${encodeURIComponent(
          docFile.type || "application/octet-stream"
        )}`,
        { credentials: "include" }
      );
      if (!uploadUrlRes.ok) {
        throw new Error(`Failed to get upload URL: ${uploadUrlRes.statusText}`);
      }

      const { uploadUrl, fileUrl } = await uploadUrlRes.json();

      // Step 2: actually upload the file
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: docFile,
        headers: {
          "Content-Type": docFile.type || "application/octet-stream",
        },
        credentials: "include",
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      // Step 3: create the DB record
      const docCreateRes = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: docTitle.trim(),
          description: "", // optional, not used here
          entityType: "property",
          entityId: property.id,
          fileUrl,
          fileName: docFile.name,
          fileSize: docFile.size, // already a number
          mimeType: docFile.type || "application/octet-stream",
        }),
      });

      if (!docCreateRes.ok) {
        const errorData = await docCreateRes.json();
        console.error("Document creation error response:", errorData);
        throw new Error(
          errorData.errors
            ? `Validation failed: ${errorData.errors.map((e: any) => e.message).join(", ")}`
            : errorData.message || "Failed to save document"
        );
      }

      setDocTitle("");
      setDocFile(null);

      await refetchDocuments();

      toast({
        title: "Document uploaded",
        description: `${docFile.name} has been attached to this property.`,
      });
    } catch (error) {
      console.error("Upload error", error);
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Upload failed",
        description: errorMsg || "Could not upload the document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (!confirm("Delete this document?")) return;
    try {
      await apiRequest("DELETE", `/api/documents/${id}`);
      await refetchDocuments();
      toast({ title: "Document deleted" });
    } catch (error) {
      console.error("Delete document error", error);
      toast({
        title: "Error",
        description: "Failed to delete document.",
        variant: "destructive",
      });
    }
  };

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const normalizeDate = (value?: string | null) =>
        value && value.trim() !== "" ? value : undefined;

      const data: any = {
        ...values,
        // ✅ ADD THESE TWO
        codeNo: values.codeNo && values.codeNo.trim() !== "" ? values.codeNo.trim() : null,
        caste: values.caste ?? null,
        price: values.price || undefined, // string is fine for decimal
        area: values.area || undefined, // stored as text in DB
        builtUpArea:
          values.builtUpArea && values.builtUpArea.trim() !== ""
            ? values.builtUpArea.trim()
            : null,
        // 🔹 send trimmed string, OR null if the user left it blank
        floor:
          values.floor && values.floor.trim() !== ""
            ? values.floor.trim()
            : null,
        constructionYear:
          values.constructionYear && values.constructionYear.trim() !== ""
            ? values.constructionYear.trim()
            : null,
        // 🔹 NEW
        furnishingStatus:
          values.furnishingStatus
            ? values.furnishingStatus
            : null,
        images: values.images || [],
        carpetArea:
          values.carpetArea && values.carpetArea.trim() !== ""
            ? values.carpetArea.trim()
            : null,
        totalFloor:
          values.totalFloor && values.totalFloor.trim() !== ""
            ? values.totalFloor.trim()
            : null,
        googleMapLink:
          values.googleMapLink && values.googleMapLink.trim() !== ""
            ? values.googleMapLink.trim()
            : undefined,

        // normalize agreement dates so empty fields become undefined
        agreementStartDate: normalizeDate(values.agreementStartDate as any),
        agreementEndDate: normalizeDate(values.agreementEndDate as any),
        // ⭐ optional field normalisation
        locationPriority:
          values.locationPriority && values.locationPriority.trim() !== ""
            ? values.locationPriority
            : undefined,
        propertyFacing: values.propertyFacing ? values.propertyFacing : null,

        bedrooms: values.bedrooms && values.bedrooms.trim() !== "" ? values.bedrooms.trim() : null,
        bathrooms: values.bathrooms && values.bathrooms.trim() !== "" ? values.bathrooms.trim() : null,
        balconies: values.balconies && values.balconies.trim() !== "" ? values.balconies.trim() : null,
        halls: values.halls && values.halls.trim() !== "" ? values.halls.trim() : null,

      };

      if (property) {
        await apiRequest("PATCH", `/api/properties/${property.id}`, data);
      } else {
        await apiRequest("POST", "/api/properties", data);
      }


    },
    onSuccess: () => {
      // Invalidate dashboard expiry query and any properties queries
      queryClient.invalidateQueries({
        queryKey: ["/api/dashboard/expiring-agreements"],
      });
      queryClient.invalidateQueries({
        predicate: (query) =>
          !!query.queryKey?.[0] &&
          typeof query.queryKey[0] === "string" &&
          (query.queryKey[0] as string).startsWith("/api/properties"),
      });
      toast({
        title: "Success",
        description: property
          ? "Property updated successfully"
          : "Property created successfully",
      });
      onOpenChange(false);
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
        description: property
          ? "Failed to update property"
          : "Failed to create property",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {property ? "Edit Property" : "Add New Property"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Title */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Luxury 3BHK Apartment"
                        {...field}
                        value={field.value || ""}
                        data-testid="input-property-title"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Code No. */}
              <div className="space-y-2">
                <Label>Code No.</Label>
                <Input
                  placeholder="e.g. A-101 / 123"
                  value={form.watch("codeNo") || ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    form.setValue("codeNo", v.trim() === "" ? null : v);
                  }}
                />
              </div>

              {/* Location */}
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Mumbai, Maharashtra"
                        {...field}
                        value={field.value || ""}
                        data-testid="input-property-location"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Google map link */}
              <FormField
                control={form.control}
                name="googleMapLink"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Google map link</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Paste full Google Maps URL here"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Price */}
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price (₹) *</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="7500000 or 50 Lakh"
                        {...field}
                        data-testid="input-property-price"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ---------------- AREA DETAILS SECTION ---------------- */}
              <div className="md:col-span-2 border p-4 rounded-lg bg-muted/30">
                <h3 className="text-lg font-semibold mb-3">Area Details</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* Area */}
                  <FormField
                    control={form.control}
                    name="area"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Area (sqft)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 1200 sqft" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* Built Up Area */}
                  <FormField
                    control={form.control}
                    name="builtUpArea"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Built Up Area (sqft)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 1200 sqft" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* Carpet Area */}
                  <FormField
                    control={form.control}
                    name="carpetArea"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Carpet Area</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 1100 sqft" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* Floor */}
                  <FormField
                    control={form.control}
                    name="floor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Floor</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 1st Floor" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* Total Floor */}
                  <FormField
                    control={form.control}
                    name="totalFloor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Floor</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 5 Floors" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="propertyFacing"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Property Facing</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select facing" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="East">East</SelectItem>
                            <SelectItem value="West">West</SelectItem>
                            <SelectItem value="South">South</SelectItem>
                            <SelectItem value="North">North</SelectItem>
                            <SelectItem value="North-East">North-East</SelectItem>
                            <SelectItem value="North-West">North-West</SelectItem>
                            <SelectItem value="South-East">South-East</SelectItem>
                            <SelectItem value="South-West">South-West</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />


                </div>
              </div>

              <div className="md:col-span-2 border p-4 rounded-lg bg-muted/30">
                <h3 className="text-lg font-semibold mb-3">Room Details</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="bedrooms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>No. of Bedroom</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 2" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bathrooms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>No. of Bathroom</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 2" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="balconies"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>No. of Balcony</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 1" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="halls"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>No. of Hall</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 1" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>


              {/* Property Category (text) */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property Category</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter property category (e.g., Residential, Commercial)"
                        {...field}
                        value={field.value || ""}
                        data-testid="input-property-type"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Transaction Type */}
              <FormField
                control={form.control}
                name="transactionType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transaction Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-transaction-type">
                          <SelectValue placeholder="Select transaction type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Buy">Buy</SelectItem>
                        <SelectItem value="Sell">Sell</SelectItem>
                        <SelectItem value="Rent">Rent</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Agreement Start Date - only for Rent */}
              <FormField
                control={form.control}
                name="agreementStartDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agreement Start Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value || ""}
                        disabled={transactionType !== "Rent"}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Agreement End Date - only for Rent */}
              <FormField
                control={form.control}
                name="agreementEndDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agreement End Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value || ""}
                        disabled={transactionType !== "Rent"}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* ✅ Construction Year */}
              <FormField
                control={form.control}
                name="constructionYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Construction Year</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g. 2018"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Lift */}
              <FormField
                control={form.control}
                name="lift"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lift</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? undefined}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select lift availability" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Available">Available</SelectItem>
                        <SelectItem value="Not Available">
                          Not Available
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {/* Parking */}
              <FormField
                control={form.control}
                name="parking"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parking</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? undefined}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select parking" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2 Wheeler">2 Wheeler</SelectItem>
                        <SelectItem value="4 Wheeler">4 Wheeler</SelectItem>
                        <SelectItem value="Common Parking">Common Parking</SelectItem>
                        <SelectItem value="Not Available">
                          Not Available
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {/* 🔹 NEW: Property Furnishing Status (left of Status) */}
              <FormField
                control={form.control}
                name="furnishingStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property Furnishing Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select furnishing status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Furnished">Furnished</SelectItem>
                        <SelectItem value="Semi-furnished">Semi-furnished</SelectItem>
                        <SelectItem value="Unfurnished">Unfurnished</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Status */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-property-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Available">Available</SelectItem>
                        <SelectItem value="Sold">Sold</SelectItem>
                        <SelectItem value="Under Construction">
                          Under Construction
                        </SelectItem>
                        <SelectItem value="Hold">Hold</SelectItem>
                        <SelectItem value="Rented">Rented</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Owner (combobox) */}
              <FormField
                control={form.control}
                name="ownerId"
                render={({ field }) => {
                  const selectedOwner = owners?.find(
                    (o) => o.id === field.value,
                  );

                  return (
                    <FormItem>
                      <FormLabel>Owner (Optional)</FormLabel>
                      <Popover
                        open={ownerOpen}
                        onOpenChange={(open) => {
                          setOwnerOpen(open);
                          if (open) setOwnerSearch("");
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between"
                            data-testid="select-property-owner"
                          >
                            {selectedOwner
                              ? `${selectedOwner.name}${selectedOwner.phone
                                ? ` (${selectedOwner.phone})`
                                : ""
                              }`
                              : "No Owner"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0">
                          <Command>
                            <CommandInput
                              placeholder="Search owner by name or phone..."
                              value={ownerSearch}
                              onValueChange={setOwnerSearch}
                            />
                            <CommandEmpty>No owner found.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="none"
                                onSelect={() => {
                                  field.onChange(undefined);
                                  setOwnerOpen(false);
                                }}
                              >
                                No Owner
                              </CommandItem>
                              {owners?.map((owner) => (
                                <CommandItem
                                  key={owner.id}
                                  value={`${owner.name} ${owner.phone ?? ""}`}
                                  onSelect={() => {
                                    field.onChange(owner.id);
                                    setOwnerOpen(false);
                                  }}
                                >
                                  {owner.name}
                                  {owner.phone && ` (${owner.phone})`}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              {/* Location Priority */}
              <FormField
                control={form.control}
                name="locationPriority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location Priority</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? undefined}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select location priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Prime Location">Prime Location</SelectItem>
                        <SelectItem value="Secondary Location">
                          Secondary Location
                        </SelectItem>
                        <SelectItem value="Normal Location">Normal Location</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />


              {/* Caste */}
              <div className="space-y-2">
                <Label>Caste</Label>
                <Select
                  value={form.watch("caste") ?? undefined}
                  onValueChange={(v) =>
                    form.setValue("caste", v as "All Caste" | "Restricted" | undefined)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select caste" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Caste">All Caste</SelectItem>
                    <SelectItem value="Restricted">Restricted</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Property Keys – optional messages for office / owner */}
              <div className="md:col-span-2 space-y-2">
                <div className="text-sm font-medium">Property Keys</div>
                <div className="text-xs text-muted-foreground">
                  (Optional – choose who has the property keys and add a note)
                </div>

                <RadioGroup
                  className="flex flex-col gap-2"
                  value={messageTarget || undefined}
                  onValueChange={(val) =>
                    setMessageTarget(val as "office" | "owner")
                  }
                >
                  {/* Office row */}
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="office" id="keys-office" />
                    <label htmlFor="keys-office" className="text-sm">
                      Office
                    </label>
                    <Input
                      placeholder="Note about keys with office"
                      disabled={messageTarget !== "office"}
                      {...form.register("officeMessage")}
                    />
                  </div>

                  {/* Owner row */}
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="owner" id="keys-owner" />
                    <label htmlFor="keys-owner" className="text-sm">
                      Owner
                    </label>
                    <Input
                      placeholder="Note about keys with owner"
                      disabled={messageTarget !== "owner"}
                      {...form.register("ownerMessage")}
                    />
                  </div>
                </RadioGroup>
              </div>

              {/* Property Images – multi upload + thumbnails */}
              <FormField
                control={form.control}
                name="images"
                render={() => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Property Images</FormLabel>
                    <FormControl>
                      <div className="space-y-3">
                        <Input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleImageChange}
                        />
                        {imagePreviews.length > 0 && (
                          <div className="flex flex-wrap gap-3">
                            {imagePreviews.map((src, index) => (
                              <div
                                key={index}
                                className="relative w-24 h-24 rounded-md overflow-hidden border"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={src}
                                  alt={`Property image ${index + 1}`}
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeImageAt(index)}
                                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 📄 Upload PDF Document (per property) */}
              {property && (
                <div className="md:col-span-2 border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-base">
                      Upload PDF Document
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      Attach PDF documents specific to this property
                    </span>
                  </div>

                  {/* Title + File + Button */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium mb-1">
                        Document Title
                      </label>
                      <Input
                        placeholder="Enter document title"
                        value={docTitle}
                        onChange={(e) => setDocTitle(e.target.value)}
                      />
                    </div>

                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium mb-1">
                        PDF File
                      </label>
                      <Input
                        type="file"
                        accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          setDocFile(file);
                        }}
                      />
                    </div>

                    <div className="md:col-span-1 flex md:justify-end">
                      <Button
                        type="button"
                        className="mt-6"
                        onClick={uploadDocument}
                        disabled={!docFile || !docTitle.trim()}
                      >
                        Upload Document
                      </Button>
                    </div>
                  </div>

                  {/* Documents table */}
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>File Name</TableHead>
                          <TableHead className="w-24 text-right">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {docsLoading ? (
                          <TableRow>
                            <TableCell colSpan={3}>
                              <span className="text-sm text-muted-foreground">
                                Loading documents...
                              </span>
                            </TableCell>
                          </TableRow>
                        ) : propertyDocuments.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3}>
                              <span className="text-sm text-muted-foreground">
                                No documents uploaded yet.
                              </span>
                            </TableCell>
                          </TableRow>
                        ) : (
                          propertyDocuments.map((doc) => (
                            <TableRow key={doc.id}>
                              <TableCell>{doc.title}</TableCell>
                              <TableCell>{doc.fileName}</TableCell>
                              <TableCell className="flex gap-2">
                                <div className="flex justify-end gap-2">
                                  {/* 👁 View (open pdf inline) */}
                                  <a href={getViewUrl(doc)} target="_blank" rel="noopener noreferrer">
                                    <button type="button" className="p-1 rounded hover:bg-muted" title="View">
                                      <Eye className="w-4 h-4" />
                                    </button>
                                  </a>


                                  {/* ⬇ Download (force download) */}
                                  <a href={`/api/documents/${doc.id}/download`}>
                                    <button type="button" className="p-1 rounded hover:bg-muted" title="Download">
                                      <Download className="w-4 h-4" />
                                    </button>
                                  </a>

                                  {/* Delete */}
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={() =>
                                      handleDeleteDocument(doc.id)
                                    }
                                  >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}


              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Property description..."
                        rows={4}
                        {...field}
                        value={field.value || ""}
                        data-testid="textarea-property-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                data-testid="button-save-property"
              >
                {mutation.isPending
                  ? "Saving..."
                  : property
                    ? "Update Property"
                    : "Create Property"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
