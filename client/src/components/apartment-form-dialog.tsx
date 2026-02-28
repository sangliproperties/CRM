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
import type { Apartment } from "@shared/schema";
import { insertApartmentSchema } from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";

interface ApartmentFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    apartment?: Apartment | null;
}

export function ApartmentFormDialog({
    open,
    onOpenChange,
    apartment,
}: ApartmentFormDialogProps) {
    const { toast } = useToast();

    const form = useForm<z.infer<typeof insertApartmentSchema>>({
        resolver: zodResolver(insertApartmentSchema),
        defaultValues: {
            name: "",
            address: "",
        },
    });

    useEffect(() => {
        // Only run reset logic when dialog is opened
        if (!open) return;

        if (apartment) {
            form.reset({
                name: apartment.name ?? "",
                address: apartment.address ?? "",
            });
        } else {
            // Add mode: always clear the form on open
            form.reset({
                name: "",
                address: "",
            });
        }
    }, [open, apartment, form]);

    const mutation = useMutation({
        mutationFn: async (values: z.infer<typeof insertApartmentSchema>) => {
            if (apartment) {
                await apiRequest("PATCH", `/api/apartments/${apartment.id}`, values);
            } else {
                await apiRequest("POST", "/api/apartments", values);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/apartments"] });
            toast({
                title: "Success",
                description: apartment
                    ? "Apartment updated successfully"
                    : "Apartment created successfully",
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
                description: apartment
                    ? "Failed to update apartment"
                    : "Failed to create apartment",
                variant: "destructive",
            });
        },
    });

    const onSubmit = (values: z.infer<typeof insertApartmentSchema>) => {
        mutation.mutate(values);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {apartment ? "Edit Apartment" : "Add New Apartment"}
                    </DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Apartment Name *</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="Sunshine Residency"
                                            {...field}
                                            data-testid="input-apartment-name"
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
                                    <FormLabel>Apartment Address</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Full address (optional)..."
                                            rows={3}
                                            {...field}
                                            value={field.value || ""}
                                            data-testid="textarea-apartment-address"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

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
                                data-testid="button-save-apartment"
                            >
                                {mutation.isPending
                                    ? "Saving..."
                                    : apartment
                                        ? "Update Apartment"
                                        : "Create Apartment"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}