import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import type { Lead, User } from "@shared/schema";
import { insertLeadSchema } from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";
import authUsers from "@/config/users.json"; // 👈 local auth config

// ✅ extend schema: budget as string, assignedTo can be string or null
const formSchema = insertLeadSchema.extend({
  budget: z.string().optional(),
  assignedTo: z.string().nullable().optional(),
  leadCreationDate: z.string().nullable().optional(),
  comments: z.string().optional(),
});

interface LeadFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null;
}

// Build a set of allowed agent emails based on users.json
// Only active Sales Agents / Marketing Executives are allowed
const allowedAgentEmails = new Set(
  authUsers
    .filter((u) => {
      const roleOK =
        u.role === "Sales Agent" || u.role === "Marketing Executive";
      // if you add "active" flag in users.json, enforce it here:
      const activeOK = (u as any).active !== false;
      return roleOK && activeOK;
    })
    .map((u) => u.email.toLowerCase())
);

export function LeadFormDialog({
  open,
  onOpenChange,
  lead,
}: LeadFormDialogProps) {
  const { toast } = useToast();

  const { data: agents } = useQuery<User[]>({
    queryKey: ["/api/users/agents"],
    onSuccess: (data) => {
      console.log("Fetched agents:", data); // Debug log
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      source: "Website",
      budget: "",
      preferredLocation: "",
      stage: "New",
      assignedTo: null, // ✅ no agent by default
      nextFollowUp: undefined,
      comments: "",
    },
  });

  useEffect(() => {
    if (lead) {
      form.reset({
        name: lead.name,
        phone: lead.phone,
        email: lead.email || "",
        source: lead.source,
        budget: lead.budget?.toString() || "",
        preferredLocation: lead.preferredLocation || "",
        stage: lead.stage,
        assignedTo: lead.assignedTo ?? null, // ✅ use null when no agent
        nextFollowUp: lead.nextFollowUp || undefined,
        leadCreationDate: lead?.leadCreationDate || undefined,
        comments: (lead as any).comments || "",
      });
    } else {
      form.reset({
        name: "",
        phone: "",
        email: "",
        source: "Website",
        budget: "",
        preferredLocation: "",
        stage: "New",
        assignedTo: null,
        nextFollowUp: undefined,
        comments: "",
      });
    }
  }, [lead, form]);

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      console.log("Form values:", values); // Debug log

      const formattedData: any = {
        ...values,
      };

      // budget: send only if user entered something
      if (!values.budget) {
        delete formattedData.budget;
      }

      // comments: send only if non-empty
      if (!values.comments) {
        delete formattedData.comments;
      }

      if (values.leadCreationDate) {
        formattedData.leadCreationDate = values.leadCreationDate;
      } else {
        delete formattedData.leadCreationDate;
      }

      // nextFollowUp: send as string when present, otherwise omit
      if (values.nextFollowUp) {
        formattedData.nextFollowUp = values.nextFollowUp; // server converts to Date
      } else {
        delete formattedData.nextFollowUp;
      }

      // ✅ assignedTo: always send, null when "No Agent Assigned"
      if (values.assignedTo == null || values.assignedTo === "") {
        formattedData.assignedTo = null;
      } else {
        formattedData.assignedTo = values.assignedTo;
      }

      console.log("Formatted data:", formattedData); // Debug log

      if (lead) {
        await apiRequest("PATCH", `/api/leads/${lead.id}`, formattedData);
      } else {
        await apiRequest("POST", "/api/leads", formattedData);
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({
        title: "Success",
        description: lead
          ? "Lead updated successfully"
          : "Lead created successfully",
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
      const errorMessage =
        error.message ||
        (lead ? "Failed to update lead" : "Failed to create lead");
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead ? "Edit Lead" : "Add New Lead"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="John Doe"
                        {...field}
                        data-testid="input-lead-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="+91 98765 43210"
                        {...field}
                        data-testid="input-lead-phone"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="john@example.com"
                        {...field}
                        value={field.value || ""}
                        data-testid="input-lead-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-lead-source">
                          <SelectValue placeholder="Select source" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Website">Website</SelectItem>
                        <SelectItem value="Referral">Referral</SelectItem>
                        <SelectItem value="Walk-in">Walk-in</SelectItem>
                        <SelectItem value="Phone Call">Phone Call</SelectItem> {/* 👈 new */}
                        <SelectItem value="Facebook">Facebook</SelectItem>
                        <SelectItem value="Instagram">Instagram</SelectItem>
                        <SelectItem value="Google">Google</SelectItem>
                        <SelectItem value="JustDial">JustDial</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="budget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget (₹)</FormLabel>
                    <FormControl>
                      <Input type="text" placeholder="5000000 or 50 lakh" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="preferredLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Location</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Mumbai, Pune..."
                        {...field}
                        value={field.value || ""}
                        data-testid="input-lead-location"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="stage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stage *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-lead-stage">
                          <SelectValue placeholder="Select stage" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="New">New</SelectItem>
                        <SelectItem value="Contacted">Contacted</SelectItem>
                        <SelectItem value="Site Visit">Site Visit</SelectItem>
                        <SelectItem value="Negotiation">
                          Negotiation
                        </SelectItem>
                        <SelectItem value="Closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Assign To */}
              <FormField
                control={form.control}
                name="assignedTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign To</FormLabel>
                    <Select
                      value={field.value ?? "none"}
                      onValueChange={(value) => {
                        field.onChange(value === "none" ? null : value);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No Agent Assigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Agent Assigned</SelectItem>
                        {agents
                          ?.filter((agent) => {
                            const email = (agent.email || "").toLowerCase();
                            return allowedAgentEmails.has(email);
                          })
                          .map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.email} ({agent.email})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="leadCreationDate"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Lead Creation Date</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                        value={
                          field.value
                            ? new Date(field.value).toISOString().slice(0, 16)
                            : ""
                        }
                        onChange={(e) =>
                          field.onChange(e.target.value || null)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nextFollowUp"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Next Follow-up Date</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                        value={
                          field.value
                            ? new Date(field.value).toISOString().slice(0, 16)
                            : ""
                        }
                        onChange={(e) =>
                          field.onChange(e.target.value || null)
                        }
                        data-testid="input-lead-followup"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="comments"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Comments/Remark</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add remarks or comments"
                        {...field}
                        data-testid="input-lead-comments"
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
                data-testid="button-save-lead"
              >
                {mutation.isPending
                  ? "Saving..."
                  : lead
                  ? "Update Lead"
                  : "Create Lead"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
