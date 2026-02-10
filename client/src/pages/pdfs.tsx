import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { FileText, Upload, Download, Trash2, File, AlertCircle, Eye } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import type { DocumentAttachment } from "@shared/schema";

export default function PDFsPage() {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [entityType, setEntityType] = useState<string>("property");
  const [entityId, setEntityId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<DocumentAttachment | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Fetch all documents (hook must be called unconditionally)
  const { data: documents = [], isLoading } = useQuery<DocumentAttachment[]>({
    queryKey: ['/api/documents'],
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file || !title || !entityType || !entityId) {
        throw new Error("Please fill in all required fields");
      }

      setUploading(true);

      // Get presigned upload URL
  const uploadUrlResponse = await fetch(`/api/documents/upload-url?fileName=${encodeURIComponent(file.name)}&mimeType=${encodeURIComponent(file.type)}`, { credentials: 'include' });
      if (!uploadUrlResponse.ok) throw new Error("Failed to get upload URL");
      
      const { uploadUrl, fileUrl } = await uploadUrlResponse.json();

      // Upload file to object storage
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
        credentials: 'include',
      });

      if (!uploadResponse.ok) throw new Error("Failed to upload file");

      // Create document record
      const documentData = {
        entityType,
        entityId,
        title,
        description: description || null,
        fileUrl,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      };

      return await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(documentData),
      }).then(res => {
        if (!res.ok) throw new Error('Failed to create document');
        return res.json();
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Document uploaded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      setTitle("");
      setDescription("");
      setEntityId("");
      setFile(null);
      setUploading(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload document",
        variant: "destructive",
      });
      setUploading(false);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/documents/${id}`);
      // DELETE returns 204 No Content, so don't try to parse JSON
      if (response.status === 204) {
        return { success: true };
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Document deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete document",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      if (selectedFile.type !== 'application/pdf') {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF file",
          variant: "destructive",
        });
        return;
      }
      // Validate file size (10MB limit)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Maximum file size is 10MB",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleView = async (doc: DocumentAttachment) => {
    try {
      const response = await fetch(`/api/documents/${doc.id}/view`);
      if (!response.ok) throw new Error("Failed to load PDF");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      setPdfUrl(url);
      setViewingDocument(doc);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load PDF for viewing",
        variant: "destructive",
      });
    }
  };

  const handleDownload = async (doc: DocumentAttachment) => {
    try {
      const response = await fetch(`/api/documents/${doc.id}/download`);
      if (!response.ok) throw new Error("Download failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download document",
        variant: "destructive",
      });
    }
  };

  const handleCloseViewer = () => {
    if (pdfUrl) {
      window.URL.revokeObjectURL(pdfUrl);
    }
    setPdfUrl(null);
    setViewingDocument(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  // Allow Admin, Property Manager and Marketing Executive to access PDFs
    // Allow any authenticated user to access this page (DEV/testing)
    const hasAccess = !!user;

  // Show loading state while auth is resolving
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }
  // Note: Page accessible to any authenticated user in DEV/testing mode

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">PDF Documents</h1>
        <p className="text-muted-foreground">Upload and manage PDF documents for properties, leads, and clients</p>
      </div>

      {/* Upload Section */}
      <Card className="border border-card-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload PDF Document
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="document-title">Document Title *</Label>
              <Input
                id="document-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter document title"
                data-testid="input-document-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="entity-type">Entity Type *</Label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger id="entity-type" data-testid="select-entity-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="property">Property</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="entity-id">Entity ID *</Label>
              <Input
                id="entity-id"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                placeholder="Enter entity ID"
                data-testid="input-entity-id"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pdf-file">PDF File *</Label>
              <Input
                id="pdf-file"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                data-testid="input-file"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter document description"
              rows={3}
              data-testid="textarea-description"
            />
          </div>

          {file && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <File className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">{file.name}</span>
              <span className="text-sm text-muted-foreground">({formatFileSize(file.size)})</span>
            </div>
          )}

          <Button
            onClick={() => uploadMutation.mutate()}
            disabled={!file || !title || !entityType || !entityId || uploading}
            data-testid="button-upload-document"
          >
            <Upload className="w-4 h-4 mr-2" />
            {uploading ? "Uploading..." : "Upload Document"}
          </Button>
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card className="border border-card-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Uploaded Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-4">Loading documents...</p>
          ) : documents.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No documents uploaded yet</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Entity Type</TableHead>
                    <TableHead>Entity ID</TableHead>
                    <TableHead>File Name</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Uploaded At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.title}</TableCell>
                      <TableCell className="capitalize">{doc.entityType}</TableCell>
                      <TableCell>{doc.entityId}</TableCell>
                      <TableCell>{doc.fileName}</TableCell>
                      <TableCell>{formatFileSize(doc.fileSize)}</TableCell>
                      <TableCell>{doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : 'N/A'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleView(doc)}
                            data-testid={`button-view-${doc.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(doc)}
                            data-testid={`button-download-${doc.id}`}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteMutation.mutate(doc.id)}
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

      {/* PDF Viewer Dialog */}
      <Dialog open={!!viewingDocument} onOpenChange={(open) => !open && handleCloseViewer()}>
        <DialogContent className="max-w-6xl h-[90vh]">
          <DialogHeader>
            <DialogTitle>{viewingDocument?.title}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 h-full overflow-hidden">
            {pdfUrl && (
              <iframe
                src={pdfUrl}
                className="w-full h-full border-0"
                title="PDF Viewer"
                data-testid="pdf-viewer-iframe"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
