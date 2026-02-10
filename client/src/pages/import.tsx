import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Trash2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as XLSX from "xlsx";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

type EntityType = "leads" | "properties" | "owners" | "clients";

interface ImportResult {
  inserted: number;
  updated: number;
  errors: Array<{ row: number; error: string }>;
}

export default function ImportPage() {
  const { toast } = useToast();
  const [selectedEntity, setSelectedEntity] = useState<EntityType>("leads");
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const { user } = useAuth();
  const isAdmin = user?.role === "Admin" || user?.role === "SuperAdmin";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseExcel(selectedFile);
    }
  };

  const parseExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      setParsedData(jsonData);
      setImportResult(null);
      setCurrentPage(1);
    };
    reader.readAsBinaryString(file);
  };

  // Fuzzy column getter: ignores spaces & case in header names
  function getColumn(row: any, keys: string[]): any {
    const normalizedRow: Record<string, any> = {};

    for (const key of Object.keys(row)) {
      const norm = key.replace(/\s+/g, "").toLowerCase();
      normalizedRow[norm] = row[key];
    }

    for (const key of keys) {
      const norm = key.replace(/\s+/g, "").toLowerCase();
      if (normalizedRow[norm] !== undefined) {
        return normalizedRow[norm];
      }
    }

    return null;
  }

  // Parse "next follow up" values from Excel to ISO string
  function parseNextFollowUpExcel(raw: any): string | null {
    if (!raw) return null;

    // Already a JS Date from XLSX
    if (raw instanceof Date) {
      return raw.toISOString();
    }

    const str = String(raw).trim();
    if (!str) return null;

    // Excel serial as number/string
    if (!isNaN(Number(str)) && str.length <= 5) {
      const serial = Number(str);
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const msPerDay = 24 * 60 * 60 * 1000;
      const d = new Date(excelEpoch.getTime() + serial * msPerDay);
      if (!isNaN(d.getTime())) return d.toISOString();
    }

    // Try direct Date parse (ISO etc.)
    const direct = new Date(str);
    if (!isNaN(direct.getTime())) return direct.toISOString();

    // Fallback: DD-MM-YYYY[ HH:MM]
    const cleaned = str.replace(/\//g, "-");
    const [datePart, timePart] = cleaned.split(/\s+/);
    const [ddStr, mmStr, yyyyStr] = datePart.split("-");
    const dd = Number(ddStr);
    const mm = Number(mmStr);
    const yyyy = Number(yyyyStr);

    if (!dd || !mm || !yyyy) return null;

    let hours = 0;
    let minutes = 0;
    if (timePart) {
      const [hhStr, minStr] = timePart.split(":");
      hours = Number(hhStr) || 0;
      minutes = Number(minStr) || 0;
    }

    const d = new Date(yyyy, mm - 1, dd, hours, minutes);
    if (isNaN(d.getTime())) return null;

    return d.toISOString();
  }


  const mapDataToEntity = (data: any[]): any[] => {
    if (selectedEntity === "leads") {
      return data.map((row: any) => {
        // Robustly detect "next follow up" column
        const rawNextFollowUp = getColumn(row, [
          "next follow up",
          "next follow-up",
          "nextfollowup",
          "next follow up date",
          "next followup date",
          "nextfollowupdate",
          "next follow-up date",
          "Next Follow-up",
          "Next Follow Up",
          "Next Follow-up Date",
          "Next Follow Up Date",
        ]);

        const nextFollowUp = parseNextFollowUpExcel(rawNextFollowUp);

        const comments =
          getColumn(row, [
            "comments",
            "comment",
            "comments/remark",
            "remarks",
            "remark",
          ]) ?? null;

        return {
          name: row.Name || row.name || "",
          phone: row.Phone || row.phone || "",
          email: row.Email || row.email || null,
          source: row.Source || row.source || "Website",
          budget:
            row.Budget || row.budget
              ? String(row.Budget || row.budget)
              : null,
          preferredLocation:
            row["Preferred Location"] ||
            row.preferredLocation ||
            null,
          stage: row.Stage || row.stage || "New",
          assignedTo: row["Assigned To"] || row.assignedTo || null,
          nextFollowUp,
          comments,
        };
      });
    } else if (selectedEntity === "properties") {
      return data.map((row: any) => ({
        title:
          row.PropertyName ||
          row.propertyName ||
          row.Title ||
          row.title ||
          "",
        type:
          row.PropertyTypeName ||
          row.propertyTypeName ||
          row.Type ||
          row.type ||
          "Residential",
        location:
          row.LocationName ||
          row.locationName ||
          row.CityName ||
          row.cityName ||
          row.Location ||
          row.location ||
          "",
        address:
          row.AddressName ||
          row.addressName ||
          row.BuildingName ||
          row.buildingName ||
          null,
        price:
          row.ExpectedPrice ||
            row.expectedPrice ||
            row.Price ||
            row.price
            ? String(
              row.ExpectedPrice ||
              row.expectedPrice ||
              row.Price ||
              row.price
            )
            : "",
        area: (() => {
          const candidate =
            row.SuperAreaName ||
            row.superAreaName ||
            row.BuiltAreaName ||
            row.builtAreaName ||
            row.CarpetAreaName ||
            row.carpetAreaName ||
            row.Area ||
            row.area ||
            row["area (sqft)"] ||
            row["Area (sqft)"] ||
            row["Super Area"] ||
            row["Built Area"] ||
            row["Carpet Area"] ||
            row["SuperArea"] ||
            row["BuiltArea"] ||
            row["CarpetArea"] ||
            null;

          if (
            candidate === null ||
            candidate === undefined ||
            candidate === ""
          )
            return null;

          return String(candidate).trim();
        })(),
        status: row.Status || row.status || "Available",
        description: row.Description || row.description || null,
        latitude:
          row.Latitude || row.latitude
            ? String(row.Latitude || row.latitude)
            : null,
        longitude:
          row.Longitude || row.longitude
            ? String(row.Longitude || row.longitude)
            : null,
        ownerName:
          row.CustomerFullName || row.customerFullName || "",
        ownerPhone:
          row.CustomerMobile || row.customerMobile || "",
      }));
    } else if (selectedEntity === "owners") {
      return data.map((row: any) => ({
        name: row.Name || row.name || "",
        phone: row.Phone || row.phone || "",
        email: row.Email || row.email || null,
        address: row.Address || row.address || null,
      }));
    } else if (selectedEntity === "clients") {
      return data.map((row: any) => ({
        name:
          row.FullName ||
          row.fullName ||
          row.Name ||
          row.name ||
          "",
        phone:
          row.Mobile ||
          row.mobile ||
          row.Phone ||
          row.phone ||
          "",
        email: row.Email || row.email || null,
        address:
          row.AddressName ||
          row.addressName ||
          row.Address ||
          row.address ||
          null,
        linkedLeadId:
          row["Linked Lead ID"] || row.linkedLeadId || null,
        linkedPropertyId:
          row["Linked Property ID"] ||
          row.linkedPropertyId ||
          null,
      }));
    }
    return [];
  };

  const handleImport = async () => {
    if (!parsedData.length) {
      toast({
        title: "No data to import",
        description: "Please upload a valid Excel file first.",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    try {
      const mappedData = mapDataToEntity(parsedData);
      console.log("📊 Starting import:", {
        entity: selectedEntity,
        totalRows: mappedData.length,
      });
      console.log("📋 First mapped row sample:", mappedData[0]);

      const BATCH_SIZE = 100;
      let totalInserted = 0;
      let totalUpdated = 0;
      let allErrors: any[] = [];

      for (let i = 0; i < mappedData.length; i += BATCH_SIZE) {
        const batch = mappedData.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(
          mappedData.length / BATCH_SIZE
        );

        console.log(
          `📦 Processing batch ${batchNum}/${totalBatches}: rows ${i + 1
          }-${Math.min(i + BATCH_SIZE, mappedData.length)}`
        );

        toast({
          title: `Processing batch ${batchNum} of ${totalBatches}`,
          description: `Processing rows ${i + 1} to ${Math.min(
            i + BATCH_SIZE,
            mappedData.length
          )}...`,
        });

        const response = await apiRequest(
          "POST",
          `/api/import/${selectedEntity}`,
          {
            data: batch,
          }
        );
        const result = response as unknown as ImportResult;
        console.log(`✅ Batch ${batchNum} result:`, result);

        totalInserted += result.inserted || 0;
        totalUpdated += result.updated || 0;
        allErrors = [
          ...allErrors,
          ...(Array.isArray(result.errors) ? result.errors : []),
        ];
      }

      const finalResult: ImportResult = {
        inserted: totalInserted,
        updated: totalUpdated,
        errors: allErrors,
      };

      setImportResult(finalResult);

      if (selectedEntity === "leads") {
        await queryClient.invalidateQueries({
          queryKey: ["/api/leads"],
        });
      } else if (selectedEntity === "properties") {
        await queryClient.invalidateQueries({
          queryKey: ["/api/properties"],
        });
      } else if (selectedEntity === "owners") {
        await queryClient.invalidateQueries({
          queryKey: ["/api/owners"],
        });
      } else if (selectedEntity === "clients") {
        await queryClient.invalidateQueries({
          queryKey: ["/api/clients"],
        });
      }

      toast({
        title: "Import completed",
        description: `Successfully imported ${finalResult.inserted + finalResult.updated
          } records.`,
      });
    } catch (error: any) {
      console.error("Import error:", error);
      toast({
        title: "Import failed",
        description:
          error.message ||
          "Failed to import data. Please check the console for details.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    let templateData: any[] = [];

    if (selectedEntity === "leads") {
      templateData = [
        {
          Name: "John Doe (Required)",
          Phone: "9876543210 (Required)",
          Email: "john@example.com (Required)",
          Source: "Website (Required)",
          Budget: "5000000",
          "Preferred Location": "Sangli",
          Stage: "New",
          "Assigned To": null,
          "next follow up": "17-11-2025 12:30",
          comments: "Sample comment",
        },
      ];
    } else if (selectedEntity === "properties") {
      templateData = [
        {
          PropertyTypeName: "Residential (Required)",
          PropertyName: "3BHK Apartment (Required)",
          AddressName: "Near Main Square",
          BuildingName: "Sunshine Apartments",
          LocationName: "Sangli Main Road (Required)",
          CityName: "Sangli",
          SuperAreaName: "1500 (Required)",
          BuiltAreaName: "1400",
          CarpetAreaName: "1300",
          ExpectedPrice: "7500000 (Required)",
          CustomerFullName: "Owner Name (Required)",
          CustomerMobile: "9876543210 (Required)",
        },
      ];
    } else if (selectedEntity === "owners") {
      templateData = [
        {
          Name: "Property Owner (Required)",
          Phone: "9876543210 (Required)",
          Email: "owner@example.com (Required)",
          Address: "123 Main Street, Sangli",
        },
      ];
    } else if (selectedEntity === "clients") {
      templateData = [
        {
          FullName: "Client Name (Required)",
          Mobile: "9876543210 (Required)",
          Email: "client@example.com (Required)",
          Phone: "0233-2345678",
          AddressName: "123 Main Street, Sangli",
        },
      ];
    }

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      selectedEntity
    );
    XLSX.writeFile(workbook, `${selectedEntity}_template.xlsx`);
  };

  if (!isAdmin) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Only administrators can access the import functionality.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Data Management</h1>
          <p className="text-muted-foreground">
            Import data and manage documents
          </p>
        </div>
      </div>

      <Tabs defaultValue="import" className="w-full">
        <TabsList data-testid="tabs-data-management">
          <TabsTrigger value="import" data-testid="tab-excel-import">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Excel Import
          </TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-document-library">
            <FileText className="w-4 h-4 mr-2" />
            Document Library
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload Excel File</CardTitle>
              <CardDescription>
                Select the entity type and upload an Excel file to import
                data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">
                    Entity Type
                  </label>
                  <Select
                    value={selectedEntity}
                    onValueChange={(value: EntityType) =>
                      setSelectedEntity(value)
                    }
                  >
                    <SelectTrigger data-testid="select-entity-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="leads">Leads</SelectItem>
                      <SelectItem value="properties">
                        Properties
                      </SelectItem>
                      <SelectItem value="owners">Owners</SelectItem>
                      <SelectItem value="clients">Clients</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  onClick={downloadTemplate}
                  data-testid="button-download-template"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Template
                </Button>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Excel File
                </label>
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                    data-testid="input-file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer"
                  >
                    <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">
                      {file
                        ? file.name
                        : "Click to upload or drag and drop"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Excel files only (.xlsx, .xls)
                    </p>
                  </label>
                </div>
              </div>

              {parsedData.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Parsed {parsedData.length} rows from the Excel
                    file. Review the data below before importing.
                  </AlertDescription>
                </Alert>
              )}

              {parsedData.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto max-h-96">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 bg-background z-10">
                            Row
                          </TableHead>
                          {Object.keys(parsedData[0])
                            .slice(0, 8)
                            .map((key) => (
                              <TableHead key={key}>{key}</TableHead>
                            ))}
                          {Object.keys(parsedData[0]).length > 8 && (
                            <TableHead className="text-muted-foreground">
                              ...
                            </TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedData
                          .slice(
                            (currentPage - 1) * rowsPerPage,
                            currentPage * rowsPerPage
                          )
                          .map((row, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="sticky left-0 bg-background z-10">
                                {(currentPage - 1) * rowsPerPage +
                                  idx +
                                  1}
                              </TableCell>
                              {Object.values(row)
                                .slice(0, 8)
                                .map((value: any, colIdx) => (
                                  <TableCell key={colIdx}>
                                    {String(value || "").substring(
                                      0,
                                      50
                                    )}
                                  </TableCell>
                                ))}
                              {Object.values(row).length > 8 && (
                                <TableCell className="text-muted-foreground">
                                  ...
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="p-3 text-sm bg-muted border-t">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <span className="text-muted-foreground">
                        Showing{" "}
                        {(currentPage - 1) * rowsPerPage + 1} to{" "}
                        {Math.min(
                          currentPage * rowsPerPage,
                          parsedData.length
                        )}{" "}
                        of {parsedData.length} rows
                        {Object.keys(parsedData[0]).length > 8 &&
                          ` • ${Object.keys(parsedData[0]).length
                          } columns (showing first 8)`}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                          data-testid="button-first-page"
                        >
                          First
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setCurrentPage((p) => Math.max(1, p - 1))
                          }
                          disabled={currentPage === 1}
                          data-testid="button-prev-page"
                        >
                          Previous
                        </Button>
                        <span className="text-sm">
                          Page {currentPage} of{" "}
                          {Math.ceil(parsedData.length / rowsPerPage)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setCurrentPage((p) =>
                              Math.min(
                                Math.ceil(
                                  parsedData.length / rowsPerPage
                                ),
                                p + 1
                              )
                            )
                          }
                          disabled={
                            currentPage ===
                            Math.ceil(
                              parsedData.length / rowsPerPage
                            )
                          }
                          data-testid="button-next-page"
                        >
                          Next
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setCurrentPage(
                              Math.ceil(
                                parsedData.length / rowsPerPage
                              )
                            )
                          }
                          disabled={
                            currentPage ===
                            Math.ceil(
                              parsedData.length / rowsPerPage
                            )
                          }
                          data-testid="button-last-page"
                        >
                          Last
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <Button
                  onClick={handleImport}
                  disabled={!parsedData.length || isImporting}
                  className="flex-1"
                  data-testid="button-import-data"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {isImporting ? "Importing..." : "Import Data"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {importResult && (
            <Card>
              <CardHeader>
                <CardTitle>Import Results</CardTitle>
                <CardDescription>
                  Summary of the import operation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Badge
                    variant="default"
                    className="flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Inserted: {importResult.inserted}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Updated: {importResult.updated}
                  </Badge>
                  {importResult.errors.length > 0 && (
                    <Badge
                      variant="destructive"
                      className="flex items-center gap-1"
                    >
                      <XCircle className="w-4 h-4" />
                      Errors: {importResult.errors.length}
                    </Badge>
                  )}
                </div>

                {importResult.errors.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Row</TableHead>
                          <TableHead>Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importResult.errors.map((error, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{error.row}</TableCell>
                            <TableCell className="text-destructive">
                              {error.error}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="documents" className="space-y-6 mt-6">
          <DocumentLibrary />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Document Library Component
function DocumentLibrary() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [entityType, setEntityType] = useState<"property" | "lead" | "client">(
    "property"
  );
  const [entityId, setEntityId] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const { data: documents = [], refetch: refetchDocuments } = useQuery<any[]>(
    {
      queryKey: ["/api/documents"],
    }
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Document deleted",
        description: "Document has been successfully deleted.",
      });
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Failed to delete document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Maximum file size is 10MB",
          variant: "destructive",
        });
        return;
      }

      if (selectedFile.type !== "application/pdf") {
        toast({
          title: "Invalid file type",
          description: "Only PDF files are allowed",
          variant: "destructive",
        });
        return;
      }

      setFile(selectedFile);
      if (!title) {
        setTitle(selectedFile.name.replace(".pdf", ""));
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !title || !entityType || !entityId) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const response = await apiRequest("GET", "/api/documents/upload-url");
      const { uploadUrl } = await response.json();

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      await apiRequest("POST", "/api/documents", {
        entityType,
        entityId,
        title,
        description,
        fileUrl: uploadUrl.split("?")[0],
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });

      toast({
        title: "Upload successful",
        description: "Document has been uploaded successfully.",
      });

      setFile(null);
      setTitle("");
      setDescription("");
      setEntityId("");
      refetchDocuments();
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (docId: string) => {
    try {
      const response = await fetch(`/api/documents/${docId}/download`);
      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const doc = documents.find((d: any) => d.id === docId);
      a.download = doc?.fileName || "document.pdf";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to download document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Upload Document</CardTitle>
          <CardDescription>
            Upload PDF documents and link them to properties, leads, or
            clients
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="doc-title">Title *</Label>
              <Input
                id="doc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Document title"
                data-testid="input-document-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-entity-type">Link To *</Label>
              <Select
                value={entityType}
                onValueChange={(value: any) =>
                  setEntityType(value)
                }
              >
                <SelectTrigger
                  id="doc-entity-type"
                  data-testid="select-entity-type"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="property">Property</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-entity-id">Entity ID *</Label>
            <Input
              id="doc-entity-id"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              placeholder={`Enter ${entityType} ID`}
              data-testid="input-entity-id"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-description">Description</Label>
            <Input
              id="doc-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              data-testid="input-document-description"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-file">PDF File *</Label>
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
                id="doc-file"
                data-testid="input-document-file"
              />
              <label htmlFor="doc-file" className="cursor-pointer">
                <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-1">
                  {file ? file.name : "Click to upload PDF"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Maximum file size: 10MB
                </p>
              </label>
            </div>
          </div>

          <Button
            onClick={handleUpload}
            disabled={isUploading || !file || !title || !entityId}
            className="w-full"
            data-testid="button-upload-document"
          >
            <Upload className="w-4 h-4 mr-2" />
            {isUploading ? "Uploading..." : "Upload Document"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Documents</CardTitle>
          <CardDescription>
            View and manage uploaded documents
          </CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No documents uploaded yet
            </p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Entity ID</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead className="text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc: any) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">
                        {doc.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {doc.entityType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {doc.entityId.substring(0, 8)}...
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatFileSize(doc.fileSize)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(doc.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleDownload(doc.id)
                            }
                            data-testid={`button-download-${doc.id}`}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              deleteMutation.mutate(doc.id)
                            }
                            data-testid={`button-delete-${doc.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
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
    </>
  );
}
