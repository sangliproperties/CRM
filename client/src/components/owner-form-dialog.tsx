import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
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
import { Button } from "@/components/ui/button";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Owner } from "@shared/schema";
import { insertOwnerSchema } from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";

interface OwnerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  owner?: Owner | null;
}

export function OwnerFormDialog({ open, onOpenChange, owner }: OwnerFormDialogProps) {
  const { toast } = useToast();

  const form = useForm<z.infer<typeof insertOwnerSchema>>({
    resolver: zodResolver(insertOwnerSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      agreedForCommission: "",
      address: "",
    },
  });

  useEffect(() => {
    if (owner) {
      form.reset({
        name: owner.name,
        phone: owner.phone,
        email: owner.email || "",
        agreedForCommission: (owner as any).agreedForCommission || "",
        address: owner.address || "",
      });
    } else {
      form.reset({
        name: "",
        phone: "",
        email: "",
        agreedForCommission: "",
        address: "",
      });
    }
  }, [owner, form]);

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof insertOwnerSchema>) => {
      if (owner) {
        await apiRequest("PATCH", `/api/owners/${owner.id}`, values);
      } else {
        await apiRequest("POST", "/api/owners", values);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owners"] });
      toast({
        title: "Success",
        description: owner ? "Owner updated successfully" : "Owner created successfully",
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
        description: owner ? "Failed to update owner" : "Failed to create owner",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof insertOwnerSchema>) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{owner ? "Edit Owner" : "Add New Owner"}</DialogTitle>
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
                    <Input placeholder="Rajesh Kumar" {...field} data-testid="input-owner-name" />
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
                    <Input placeholder="+91 98765 43210" {...field} data-testid="input-owner-phone" />
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
                    <Input type="email" placeholder="rajesh@example.com" {...field} value={field.value || ""} data-testid="input-owner-email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="agreedForCommission"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Agreed For Commission</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter agreed commission..."
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />


            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Full address..." rows={3} {...field} value={field.value || ""} data-testid="textarea-owner-address" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-save-owner">
                {mutation.isPending ? "Saving..." : owner ? "Update Owner" : "Create Owner"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
