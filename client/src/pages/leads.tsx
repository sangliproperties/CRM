import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Phone, Mail, Edit, Trash2, MessageCircle, Info, RefreshCw } from "lucide-react";
import type { Activity } from "@shared/schema";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { LeadFormDialog } from "@/components/lead-form-dialog";
import { LeadDetailDrawer } from "@/components/lead-detail-drawer";
import type { Lead } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { Alert, AlertDescription } from "@/components/ui/alert";

const stageColors: Record<string, string> = {
  "New": "bg-blue-100 text-blue-700 hover:bg-blue-100",
  "Contacted": "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
  "Site Visit": "bg-purple-100 text-purple-700 hover:bg-purple-100",
  "Negotiation": "bg-orange-100 text-orange-700 hover:bg-orange-100",
  "Closed": "bg-green-100 text-green-700 hover:bg-green-100"
};

function LeadNotesDropdown({ leadId }: { leadId: string }) {
  const { data: activities, isLoading } = useQuery<any[]>({
    queryKey: [`/api/leads/${leadId}/activities`],
    enabled: !!leadId,
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  const items = (activities ?? []).slice().sort((a, b) => {
    const ta = new Date(a.createdAt ?? 0).getTime();
    const tb = new Date(b.createdAt ?? 0).getTime();
    return tb - ta; // latest first
  });

  if (items.length === 0) {
    return <div className="text-sm text-muted-foreground">No activity yet.</div>;
  }

  // Helper to show proper title like drawer
  const getTitle = (type: string) => {
    if (!type) return "Activity";
    return type
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  return (
    <div className="space-y-2">
      {items.map((a) => (
        <div key={a.id} className="rounded-md border p-3 bg-muted/30">
          <div className="text-sm font-medium">{getTitle(a.type)}</div>

          {a.description && <div className="text-sm mt-1">{a.description}</div>}

          <div className="text-xs text-muted-foreground mt-1">
            {a.createdAt ? new Date(a.createdAt).toLocaleString() : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Leads() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: leads, isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  const toggleExpand = (leadId: string) => {
    setExpandedLeadId((prev) => (prev === leadId ? null : leadId));
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/leads/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({
        title: "Success",
        description: "Lead deleted successfully",
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
        description: "Failed to delete lead",
        variant: "destructive",
      });
    },
  });

  const filteredLeads = leads?.filter((lead) => {
    const lowerSearch = searchTerm.toLowerCase();

    const matchesSearch =
      lead.name.toLowerCase().includes(lowerSearch) ||
      lead.phone.includes(searchTerm) ||
      (lead.email?.toLowerCase().includes(lowerSearch) ?? false) ||
      (lead.preferredLocation?.toLowerCase().includes(lowerSearch) ?? false) ||
      (lead.comments?.toLowerCase().includes(lowerSearch) ?? false); // 🔍 search in comments/remark

    const matchesStage = stageFilter === "all" || lead.stage === stageFilter;
    const matchesSource = sourceFilter === "all" || lead.source === sourceFilter;

    return matchesSearch && matchesStage && matchesSource;
  }) || [];


  const handleEdit = (lead: Lead) => {
    setSelectedLead(lead);
    setIsFormOpen(true);
  };

  const handleViewDetails = (lead: Lead) => {
    setSelectedLead(lead);
    setIsDetailOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this lead?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleWhatsApp = (phone: string) => {
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
  };

  const handleEmail = (email: string) => {
    window.location.href = `mailto:${email}`;
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Leads</h1>
          <p className="text-muted-foreground">Manage and track your sales leads</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            data-testid="button-refresh-leads"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            className="bg-gold hover:bg-gold/90 text-gold-foreground"
            onClick={() => {
              setSelectedLead(null);
              setIsFormOpen(true);
            }}
            data-testid="button-add-lead"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Lead
          </Button>
        </div>
      </div>

      {(user?.role === "Sales Agent" || user?.role === "Marketing Executive") && (
        <Alert className="bg-blue-50 border-blue-200" data-testid="alert-filtered-view">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-700">
            You are viewing only leads assigned to you. Contact your admin to see all leads.
          </AlertDescription>
        </Alert>
      )}

      <Card className="border border-card-border">
        <CardHeader>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, email, location, or comments/remarks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-leads"
              />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-full lg:w-[180px]" data-testid="select-stage-filter">
                <SelectValue placeholder="Filter by stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                <SelectItem value="New">New</SelectItem>
                <SelectItem value="Contacted">Contacted</SelectItem>
                <SelectItem value="Site Visit">Site Visit</SelectItem>
                <SelectItem value="Negotiation">Negotiation</SelectItem>
                <SelectItem value="Closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-full lg:w-[180px]" data-testid="select-source-filter">
                <SelectValue placeholder="Filter by source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="Website">Website</SelectItem>
                <SelectItem value="Referral">Referral</SelectItem>
                <SelectItem value="Walk-in">Walk-in</SelectItem>
                <SelectItem value="Phone Call">Phone Call</SelectItem> {/* NEW */}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No leads found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Comments / Remark</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredLeads.map((lead) => (
                    <>
                      <TableRow
                        className="cursor-pointer hover-elevate"
                        onClick={() => handleViewDetails(lead)}
                        data-testid={`lead-row-${lead.id}`}
                      >
                        <TableCell className="font-medium">{lead.name}</TableCell>

                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-sm">{lead.phone}</div>
                            {lead.email && (
                              <div className="text-xs text-muted-foreground">{lead.email}</div>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          {lead.leadCreationDate ? new Date(lead.leadCreationDate).toLocaleString() : "-"}
                        </TableCell>

                        <TableCell>
                          <Badge variant="outline">{lead.source}</Badge>
                        </TableCell>

                        <TableCell>{lead.budget ? `₹${lead.budget}` : "-"}</TableCell>

                        <TableCell>{lead.preferredLocation || "-"}</TableCell>

                        {/* ⭐ NEW COMMENTS/REMARK COLUMN */}
                        <TableCell>{lead.comments || lead.remark || "-"}</TableCell>

                        {/* Stage = dropdown trigger */}
                        <TableCell>
                          <Badge className={stageColors[lead.stage] || ""}>{lead.stage}</Badge>
                        </TableCell>

                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">

                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(lead.id);
                              }}
                              title={expandedLeadId === lead.id ? "Hide Notes" : "Show Notes"}
                            >
                              {expandedLeadId === lead.id ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </Button>

                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleWhatsApp(lead.phone)}
                              title="WhatsApp"
                              data-testid={`button-whatsapp-${lead.id}`}
                            >
                              <MessageCircle className="w-4 h-4 text-green-600" />
                            </Button>

                            {lead.email && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleEmail(lead.email!)}
                                title="Email"
                                data-testid={`button-email-${lead.id}`}
                              >
                                <Mail className="w-4 h-4 text-blue-600" />
                              </Button>
                            )}

                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEdit(lead)}
                              title="Edit"
                              data-testid={`button-edit-${lead.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>

                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDelete(lead.id)}
                              title="Delete"
                              data-testid={`button-delete-${lead.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* ✅ Expanded dropdown row */}
                      {expandedLeadId === lead.id && (
                        <TableRow>
                          <TableCell colSpan={9} className="bg-muted/20">
                            <div className="p-3">
                              <div className="text-sm font-medium mb-2">Marketing Executive Notes</div>

                              {/* This component should exist in the same file (or imported) */}
                              <LeadNotesDropdown leadId={lead.id} assignedTo={lead.assignedTo ?? null} />
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>

            </div>
          )}
        </CardContent>
      </Card>

      <LeadFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        lead={selectedLead}
      />

      <LeadDetailDrawer
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        lead={selectedLead}
      />
    </div>
  );
}
