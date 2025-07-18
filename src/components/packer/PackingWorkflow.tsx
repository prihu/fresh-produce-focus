import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { useState, useEffect, useCallback } from "react";
import { Skeleton } from "../ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import OrderDetailsCard from "./packing/OrderDetailsCard";
import QualityAssuranceSection from "./packing/QualityAssuranceSection";
import FinalizePackingSection from "./packing/FinalizePackingSection";
import { useToast } from "@/hooks/use-toast";
import { useAnalysisCleanup } from "@/hooks/useAnalysisCleanup";

type Order = Tables<'orders'>;
type Product = Tables<'products'>;
type PackingPhoto = Tables<'packing_photos'>;

const fetchOrderDetails = async (orderId: string) => {
    const { data, error } = await supabase.from("orders").select("*").eq("id", orderId).single();
    if (error) throw new Error(error.message);
    return data;
};

const fetchProduct = async () => {
    const { data, error } = await supabase.from('products').select('*').limit(1).single();
    if (error) throw new Error(error.message);
    return data;
};

const fetchPackingPhoto = async (orderId: string, productId: string) => {
    const { data, error } = await supabase
      .from('packing_photos')
      .select('*')
      .eq('order_id', orderId)
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    // Error is expected if no photo exists, so we don't throw it.
    return data;
}

const PackingWorkflow = ({ orderId }: { orderId: string }) => {
    const [packingPhoto, setPackingPhoto] = useState<PackingPhoto | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
    const [retryCount, setRetryCount] = useState(0);
    const queryClient = useQueryClient();
    const { toast } = useToast();
    
    // Auto-cleanup stuck analyses
    useAnalysisCleanup();

    const { data: order, isLoading: isLoadingOrder } = useQuery<Order>({
        queryKey: ["orderDetails", orderId],
        queryFn: () => fetchOrderDetails(orderId),
    });

    const { data: product, isLoading: isLoadingProduct } = useQuery<Product>({
        queryKey: ["product"],
        queryFn: fetchProduct,
    });
    
    const {data: initialPackingPhoto, isLoading: isLoadingPhoto } = useQuery<PackingPhoto | null>({
        queryKey: ['packingPhoto', orderId, product?.id],
        queryFn: () => fetchPackingPhoto(orderId, product!.id),
        enabled: !!product,
    });

    useEffect(() => {
        if(initialPackingPhoto) {
            setPackingPhoto(initialPackingPhoto);
        }
    }, [initialPackingPhoto]);

    // Enhanced real-time subscription with better error handling
    const setupRealtimeSubscription = useCallback(() => {
        if (!packingPhoto?.id) return;

        const channelName = `packing_photo_${packingPhoto.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log('Setting up real-time subscription for photo:', packingPhoto.id, 'Channel:', channelName);
        setConnectionStatus('connecting');

        const channel = supabase
            .channel(channelName)
            .on<PackingPhoto>(
                'postgres_changes',
                { 
                    event: 'UPDATE', 
                    schema: 'public', 
                    table: 'packing_photos',
                    filter: `id=eq.${packingPhoto.id}`
                },
                async (payload) => {
                    console.log('Real-time update received:', payload.new);
                    const updatedPhoto = payload.new as PackingPhoto;
                    setPackingPhoto(updatedPhoto);
                    setConnectionStatus('connected');
                    setRetryCount(0);
                    
                    // Show success toast for status changes
                    if (updatedPhoto.ai_analysis_status === 'completed') {
                        toast({
                            title: "Analysis Complete!",
                            description: "Quality scores have been generated.",
                        });

                        // Automatically update order status when analysis completes with good scores
                        const qualityScore = updatedPhoto.quality_score ?? 0;
                        const freshnessScore = updatedPhoto.freshness_score ?? 0;
                        const isProduceDetected = updatedPhoto.item_name && 
                            !updatedPhoto.item_name.toLowerCase().includes('not') &&
                            !updatedPhoto.item_name.toLowerCase().includes('unidentified');

                        if (qualityScore >= 6 && freshnessScore >= 6 && isProduceDetected) {
                            try {
                                const { error: statusError } = await supabase
                                    .from('orders')
                                    .update({ status: 'quality_checked' })
                                    .eq('id', orderId);

                                if (!statusError) {
                                    queryClient.invalidateQueries({ queryKey: ["orderDetails", orderId] });
                                }
                            } catch (error) {
                                console.error('Error updating order status:', error);
                            }
                        }
                    } else if (updatedPhoto.ai_analysis_status === 'failed') {
                        toast({
                            title: "Analysis Failed",
                            description: "Please try uploading the image again or use the retry button.",
                            variant: "destructive",
                        });
                    }
                }
            )
            .subscribe((status) => {
                console.log('Subscription status:', status, 'for channel:', channelName);
                if (status === 'SUBSCRIBED') {
                    setConnectionStatus('connected');
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    setConnectionStatus('disconnected');
                    console.error('Real-time subscription error:', status);
                    
                    // Retry connection with exponential backoff (max 3 attempts)
                    if (retryCount < 3) {
                        const delay = Math.pow(2, retryCount) * 1000;
                        setTimeout(() => {
                            setRetryCount(prev => prev + 1);
                        }, delay);
                    }
                }
            });

        return () => {
            console.log('Cleaning up real-time subscription for channel:', channelName);
            supabase.removeChannel(channel);
        };
    }, [packingPhoto?.id, retryCount, toast, orderId, queryClient]);

    useEffect(() => {
        const cleanup = setupRealtimeSubscription();
        return cleanup;
    }, [setupRealtimeSubscription]);

    // Enhanced backup polling for disconnected state
    useEffect(() => {
        if (connectionStatus === 'disconnected' && packingPhoto?.ai_analysis_status === 'pending') {
            console.log('Real-time disconnected, falling back to polling');
            
            const pollInterval = setInterval(async () => {
                try {
                    const { data, error } = await supabase
                        .from('packing_photos')
                        .select('*')
                        .eq('id', packingPhoto.id)
                        .single();

                    if (error) {
                        console.error('Polling error:', error);
                        return;
                    }

                    if (data && data.ai_analysis_status !== packingPhoto.ai_analysis_status) {
                        console.log('Status updated via polling:', data.ai_analysis_status);
                        setPackingPhoto(data);
                        
                        if (data.ai_analysis_status === 'completed') {
                            toast({
                                title: "Analysis Complete!",
                                description: "Quality scores have been generated.",
                            });
                        }
                    }
                } catch (error) {
                    console.error('Polling failed:', error);
                }
            }, 3000); // Poll every 3 seconds when disconnected

            return () => clearInterval(pollInterval);
        }
    }, [connectionStatus, packingPhoto?.id, packingPhoto?.ai_analysis_status, toast]);

    const handlePhotoUploaded = (photo: PackingPhoto) => {
        console.log('Photo uploaded:', photo);
        setPackingPhoto(photo);
        setRetryCount(0);
    };

    const handlePhotoDeleted = async () => {
        console.log('Photo deleted');
        setPackingPhoto(null);
        setConnectionStatus('connecting');

        // Revert order status to 'pending_packing' when photo is deleted
        try {
            const { error: statusError } = await supabase
                .from('orders')
                .update({ status: 'pending_packing' })
                .eq('id', orderId);

            if (!statusError) {
                queryClient.invalidateQueries({ queryKey: ["orderDetails", orderId] });
            }
        } catch (error) {
            console.error('Error reverting order status:', error);
        }
    };

    const handlePhotoStatusUpdate = (updatedPhoto: PackingPhoto) => {
        console.log('Photo status updated:', updatedPhoto);
        setPackingPhoto(updatedPhoto);
    };

    if (isLoadingOrder || isLoadingProduct || isLoadingPhoto) {
        return <Skeleton className="h-96 w-full" />;
    }

    if (!order || !product) {
        return (
            <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>Could not load order or product details.</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="space-y-6">
            {/* Enhanced debug info for development */}
            {process.env.NODE_ENV === 'development' && (
                <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
                    Connection: {connectionStatus} | Retries: {retryCount} | Photo Status: {packingPhoto?.ai_analysis_status || 'none'} | Photo ID: {packingPhoto?.id || 'none'} | Order Status: {order.status}
                </div>
            )}
            
            <OrderDetailsCard order={order} product={product} />
            <QualityAssuranceSection 
                orderId={orderId} 
                product={product} 
                packingPhoto={packingPhoto}
                orderStatus={order.status}
                onPhotoUploaded={handlePhotoUploaded}
                onPhotoDeleted={handlePhotoDeleted}
                onPhotoStatusUpdate={handlePhotoStatusUpdate}
            />
            <FinalizePackingSection order={order} packingPhoto={packingPhoto} />
        </div>
    );
};

export default PackingWorkflow;
