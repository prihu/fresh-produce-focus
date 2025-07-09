
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSecureAuth } from "@/contexts/SecureAuthContext";

export const useDeleteOrder = () => {
    const { toast } = useToast();
    const { user } = useSecureAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (orderId: string) => {
            if (!user) {
                throw new Error('Authentication required');
            }

            // Optimistically remove from cache immediately for instant UI feedback
            const previousData = queryClient.getQueryData(['packerOrders']);
            queryClient.setQueryData(['packerOrders'], (oldData: any) => {
                if (!oldData) return oldData;
                return oldData.filter((order: any) => order.id !== orderId);
            });

            try {
                // First verify the order can be deleted (manually created, not packed, belongs to user)
                const { data: order, error: fetchError } = await supabase
                    .from('orders')
                    .select('manually_created, status, packer_id')
                    .eq('id', orderId)
                    .single();

                if (fetchError) {
                    throw new Error('Failed to fetch order details');
                }

                if (!order.manually_created) {
                    throw new Error('Only manually created orders can be deleted');
                }

                if (order.status === 'packed') {
                    throw new Error('Cannot delete packed orders');
                }

                if (order.packer_id !== user.id) {
                    throw new Error('You can only delete your own orders');
                }

                // Delete associated photos first (cascade should handle this, but being explicit)
                const { error: photosError } = await supabase
                    .from('packing_photos')
                    .delete()
                    .eq('order_id', orderId);

                if (photosError) {
                    console.warn('Error deleting photos:', photosError);
                    // Continue with order deletion even if photo deletion fails
                }

                // Delete the order
                const { error: deleteError } = await supabase
                    .from('orders')
                    .delete()
                    .eq('id', orderId);

                if (deleteError) {
                    throw new Error(`Failed to delete order: ${deleteError.message}`);
                }

                return { orderId, previousData };
            } catch (error) {
                // Restore previous data on error
                queryClient.setQueryData(['packerOrders'], previousData);
                throw error;
            }
        },
        onSuccess: ({ orderId }) => {
            toast({
                title: "Order Deleted",
                description: "The order has been successfully deleted.",
            });

            // Final invalidation to ensure consistency
            queryClient.invalidateQueries({ queryKey: ['packerOrders'] });
        },
        onError: (error: any) => {
            toast({
                title: "Delete Failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });
};
