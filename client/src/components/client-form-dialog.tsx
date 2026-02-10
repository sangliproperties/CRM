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
import type { Client, Lead, Property } from "@shared/schema";
import { insertClientSchema } from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
}

export function ClientFormDialog({ open, onOpenChange, client }: ClientFormDialogProps) {
  const { toast } = useToast();

  const { data: leads = [] } = useQuery({
    queryKey: ["/api/leads"],
    select: (res: any): Lead[] => {
      if (Array.isArray(res)) return res;
      if (Array.isArray(res?.data)) return res.data;
      if (Array.isArray(res?.leads)) return res.leads;
      if (Array.isArray(res?.items)) return res.items;
      return [];
    },
  });

  const { data: properties = [] } = useQuery({
    queryKey: ["/api/properties"],
    select: (res: any): Property[] => {
      if (Array.isArray(res)) return res;
      if (Array.isArray(res?.data)) return res.data;
      if (Array.isArray(res?.properties)) return res.properties;
      if (Array.isArray(res?.items)) return res.items;
      return [];
    },
  });

  const form = useForm<z.infer<typeof insertClientSchema>>({
    resolver: zodResolver(insertClientSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "" as string,
      linkedLeadId: undefined,
      linkedPropertyId: undefined,
    },
  });

  useEffect(() => {
    if (client) {
      form.reset({
        name: client.name,
        phone: client.phone,
        email: client.email || "",
        linkedLeadId: client.linkedLeadId || undefined,
        linkedPropertyId: client.linkedPropertyId || undefined,
      });
    } else {
      form.reset({
        name: "",
        phone: "",
        email: "",
        linkedLeadId: undefined,
        linkedPropertyId: undefined,
      });
    }
  }, [client, form]);

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof insertClientSchema>) => {
      if (client) {
        await apiRequest("PATCH", `/api/clients/${client.id}`, values);
      } else {
        await apiRequest("POST", "/api/clients", values);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Success",
        description: client ? "Client updated successfully" : "Client created successfully",
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
        description: client ? "Failed to update client" : "Failed to create client",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof insertClientSchema>) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{client ? "Edit Client" : "Add New Client"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Priya Sharma" {...field} data-testid="input-client-name" />
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
                    <Input placeholder="+91 98765 43210" {...field} data-testid="input-client-phone" />
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
                    <Input type="email" placeholder="priya@example.com" {...field} data-testid="input-client-email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="linkedLeadId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Linked Lead</FormLabel>
                  <Select
                    value={field.value == null ? "__none__" : String(field.value)}
                    onValueChange={(val) => field.onChange(val === "__none__" ? undefined : val)}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-client-lead">
                        <SelectValue placeholder="Select lead" />
                      </SelectTrigger>
                    </FormControl>

                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>

                      {leads.map((lead) => (
                        <SelectItem key={lead.id} value={String(lead.id)}>
                          {lead.name} - {lead.phone}
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
              name="linkedPropertyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Linked Property</FormLabel>
                  <Select
                    value={field.value == null ? "__none__" : String(field.value)}
                    onValueChange={(val) => field.onChange(val === "__none__" ? undefined : val)}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-client-property">
                        <SelectValue placeholder="Select property" />
                      </SelectTrigger>
                    </FormControl>

                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>

                      {properties.map((property) => (
                        <SelectItem key={property.id} value={String(property.id)}>
                          {property.title} - {property.location}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-save-client">
                {mutation.isPending ? "Saving..." : client ? "Update Client" : "Create Client"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
