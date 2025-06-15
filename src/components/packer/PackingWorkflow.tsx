
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { useState, useEffect } from "react";
import { Skeleton } from "../ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import OrderDetailsCard from "./packing/OrderDetailsCard";
import QualityAssuranceSection from "./packing/QualityAssuranceSection";
import FinalizePackingSection from "./packing/FinalizePackingSection";

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
    const queryClient = useQueryClient();

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

    useEffect(() => {
        if (!packingPhoto?.id) return;

        const channel = supabase
        .channel(`packing_photo_update:${packingPhoto.id}`)
        .on<PackingPhoto>(
            'postgres_changes',
            { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'packing_photos',
                filter: `id=eq.${packingPhoto.id}`
            },
            (payload) => {
                setPackingPhoto(payload.new as PackingPhoto);
            }
        )
        .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [packingPhoto?.id]);

    const handlePhotoUploaded = (photo: PackingPhoto) => {
        setPackingPhoto(photo);
    };

    if (isLoadingOrder || isLoadingProduct || isLoadingPhoto) {
        return <Skeleton className="h-96 w-full" />;
    }

    if (!order || !product) {
        return <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>Could not load order or product details.</AlertDescription></Alert>;
    }

    return (
        <div className="space-y-6">
            <OrderDetailsCard order={order} product={product} />
            <QualityAssuranceSection 
                orderId={orderId} 
                product={product} 
                packingPhoto={packingPhoto}
                onPhotoUploaded={handlePhotoUploaded}
            />
            <FinalizePackingSection order={order} packingPhoto={packingPhoto} />
        </div>
    );
};

export default PackingWorkflow;
