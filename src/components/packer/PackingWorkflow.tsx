
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

        console.log('Setting up real-time subscription for photo:', packingPhoto.id);
        setConnectionStatus('connecting');

        const channel = supabase
            .channel(`packing_photo_update:${packingPhoto.id}:${Date.now()}`) // Unique channel name
            .on<PackingPhoto>(
                'postgres_changes',
                { 
                    event: 'UPDATE', 
                    schema: 'public', 
                    table: 'packing_photos',
                    filter: `id=eq.${packingPhoto.id}`
                },
                (payload) => {
                    console.log('Real-time update received:', payload.new);
                    setPackingPhoto(payload.new as PackingPhoto);
                    setConnectionStatus('connected');
                    setRetryCount(0); // Reset retry count on successful update
                    
                    // Show success toast for status changes
                    if (payload.new.ai_analysis_status === 'completed') {
                        toast({
                            title: "Analysis Complete!",
                            description: "Quality scores have been generated.",
                        });
                    } else if (payload.new.ai_analysis_status === 'failed') {
                        toast({
                            title: "Analysis Failed",
                            description: "Please try uploading the image again.",
                            variant: "destructive",
                        });
                    }
                }
            )
            .subscribe((status) => {
                console.log('Subscription status:', status);
                if (status === 'SUBSCRIBED') {
                    setConnectionStatus('connected');
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    setConnectionStatus('disconnected');
                    console.error('Real-time subscription error:', status);
                    
                    // Retry connection after delay
                    if (retryCount < 3) {
                        setTimeout(() => {
                            setRetryCount(prev => prev + 1);
                            setupRealtimeSubscription();
                        }, Math.pow(2, retryCount) * 1000); // Exponential backoff
                    }
                }
            });

        return () => {
            console.log('Cleaning up real-time subscription');
            supabase.removeChannel(channel);
        };
    }, [packingPhoto?.id, retryCount, toast]);

    useEffect(() => {
        const cleanup = setupRealtimeSubscription();
        return cleanup;
    }, [setupRealtimeSubscription]);

    // Backup polling mechanism when real-time fails
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
            }, 2000); // Poll every 2 seconds when disconnected

            return () => clearInterval(pollInterval);
        }
    }, [connectionStatus, packingPhoto?.id, packingPhoto?.ai_analysis_status, toast]);

    const handlePhotoUploaded = (photo: PackingPhoto) => {
        console.log('Photo uploaded:', photo);
        setPackingPhoto(photo);
        setRetryCount(0); // Reset retry count for new photo
    };

    const handlePhotoDeleted = () => {
        console.log('Photo deleted');
        setPackingPhoto(null);
        setConnectionStatus('connecting');
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
            {/* Debug info for development */}
            {process.env.NODE_ENV === 'development' && (
                <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
                    Connection: {connectionStatus} | Retries: {retryCount} | Photo Status: {packingPhoto?.ai_analysis_status || 'none'}
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
