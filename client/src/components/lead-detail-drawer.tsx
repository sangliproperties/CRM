import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Phone,
  Mail,
  MapPin,
  DollarSign,
  Calendar,
  User,
  MessageCircle,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";

import type { Lead, Activity } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isUnauthorizedError } from "@/lib/authUtils";


interface LeadDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
}

const stageColors: Record<string, string> = {
  "New": "bg-blue-100 text-blue-700 hover:bg-blue-100",
  "Contacted": "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
  "Site Visit": "bg-purple-100 text-purple-700 hover:bg-purple-100",
  "Negotiation": "bg-orange-100 text-orange-700 hover:bg-orange-100",
  "Closed": "bg-green-100 text-green-700 hover:bg-green-100"
};

export function LeadDetailDrawer({ open, onOpenChange, lead }: LeadDetailDrawerProps) {
  const { toast } = useToast();
  const [activityType, setActivityType] = useState("note");
  const [activityDescription, setActivityDescription] = useState("");
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);


  const { data: activities, isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ["/api/leads", lead?.id, "activities"],
    enabled: !!lead?.id,
  });

  const addActivityMutation = useMutation({
    mutationFn: async (data: { type: string; description: string }) => {
      await apiRequest("POST", `/api/leads/${lead?.id}/activities`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", lead?.id, "activities"] });
      setActivityDescription("");
      toast({
        title: "Success",
        description: "Activity added successfully",
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
        description: "Failed to add activity",
        variant: "destructive",
      });
    },
  });

  const updateActivityMutation = useMutation({
    mutationFn: async (data: { id: string; type: string; description: string }) => {
      await apiRequest("PATCH", `/api/activities/${data.id}`, {
        type: data.type,
        description: data.description,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/leads", lead?.id, "activities"],
      });
      setActivityDescription("");
      setEditingActivityId(null);
      toast({
        title: "Success",
        description: "Activity updated successfully",
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
        description: "Failed to update activity",
        variant: "destructive",
      });
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/activities/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/leads", lead?.id, "activities"],
      });
      toast({
        title: "Success",
        description: "Activity deleted successfully",
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
        description: "Failed to delete activity",
        variant: "destructive",
      });
    },
  });


  const handleAddActivity = () => {
    if (!activityDescription.trim()) return;

    if (editingActivityId) {
      updateActivityMutation.mutate({
        id: editingActivityId,
        type: activityType,
        description: activityDescription,
      });
    } else {
      addActivityMutation.mutate({
        type: activityType,
        description: activityDescription,
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingActivityId(null);
    setActivityDescription("");
    setActivityType("note");
  };



  if (!lead) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-2xl">{lead.name}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status Badge */}
          <div>
            <Badge className={stageColors[lead.stage]}>{lead.stage}</Badge>
          </div>

          {/* Contact Information */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase">Contact Information</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{lead.phone}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="hover-elevate"
                  onClick={() => {
                    const message = `Hello ${lead.name}, this is Sangli Properties. We would like to discuss your property requirements. When would be a good time to talk?`;
                    const whatsappUrl = `https://wa.me/${lead.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
                    window.open(whatsappUrl, '_blank');
                  }}
                  data-testid="button-whatsapp"
                >
                  <MessageCircle className="w-4 h-4 text-green-600" />
                </Button>
              </div>
              {lead.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{lead.email}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="hover-elevate"
                    onClick={() => {
                      const subject = `Property Inquiry - ${lead.name}`;
                      const body = `Dear ${lead.name},\n\nThank you for your interest in Sangli Properties. We would like to discuss your property requirements.\n\nBest regards,\nSangli Properties LLP`;
                      window.location.href = `mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                    }}
                    data-testid="button-email"
                  >
                    <Mail className="w-4 h-4 text-blue-600" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Lead Details */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase">Lead Details</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">
                  Budget: {lead.budget ? `₹${lead.budget}` : "Not specified"}
                </span>

              </div>
              {lead.preferredLocation && (
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Location: {lead.preferredLocation}</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Source: {lead.source}</span>
              </div>
              {lead.nextFollowUp && (
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    Next Follow-up: {new Date(lead.nextFollowUp).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Add Activity */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase">Add Activity</h3>
            <Select value={activityType} onValueChange={setActivityType}>
              <SelectTrigger data-testid="select-activity-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="call">Phone Call</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="note">Note</SelectItem>
                <SelectItem value="site_visit">Site Visit</SelectItem>
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Add activity details..."
              value={activityDescription}
              onChange={(e) => setActivityDescription(e.target.value)}
              rows={3}
              data-testid="textarea-activity-description"
            />
            <div className="flex gap-2">
              <Button
                onClick={handleAddActivity}
                disabled={
                  !activityDescription.trim() ||
                  addActivityMutation.isPending ||
                  updateActivityMutation.isPending
                }
                className="flex-1"
                data-testid="button-add-activity"
              >
                {editingActivityId ? (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Update Activity
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Activity
                  </>
                )}
              </Button>

              {editingActivityId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelEdit}
                  className="flex-none"
                >
                  Cancel
                </Button>
              )}
            </div>

          </div>

          <Separator />

          {/* Activity Timeline */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase">Activity Timeline</h3>
            {activitiesLoading ? (
              <p className="text-sm text-muted-foreground">Loading activities...</p>
            ) : activities && activities.length > 0 ? (
              <div className="space-y-4">
                {activities.map((activity) => (
                  <div key={activity.id} className="flex gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${activity.type === "call"
                          ? "bg-blue-100 text-blue-600"
                          : activity.type === "meeting"
                            ? "bg-green-100 text-green-600"
                            : activity.type === "email"
                              ? "bg-purple-100 text-purple-600"
                              : activity.type === "site_visit"
                                ? "bg-orange-100 text-orange-600"
                                : "bg-gray-100 text-gray-600"
                        }`}
                    >
                      {activity.type === "call" ? (
                        <Phone className="w-4 h-4" />
                      ) : activity.type === "email" ? (
                        <Mail className="w-4 h-4" />
                      ) : activity.type === "site_visit" ? (
                        <MapPin className="w-4 h-4" />
                      ) : (
                        <User className="w-4 h-4" />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium capitalize">
                            {activity.type.replace("_", " ")}
                          </p>
                          <p className="text-sm text-foreground mt-1">{activity.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(activity.createdAt!).toLocaleString()}
                          </p>
                        </div>

                        <div className="flex gap-1 mt-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => {
                              setEditingActivityId(activity.id);
                              setActivityType(activity.type);
                              setActivityDescription(activity.description);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-red-600"
                            onClick={() => {
                              if (confirm("Delete this activity?")) {
                                deleteActivityMutation.mutate(activity.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No activities yet</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
