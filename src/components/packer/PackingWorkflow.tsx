
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { useState, useEffect } from "react";
import PhotoCapture from "./PhotoCapture";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "../ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Badge } from "../ui/badge";
import { CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Lock } from "lucide-react";

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
    const [isPhotoCaptureOpen, setIsPhotoCaptureOpen] = useState(false);
    const [packingPhoto, setPackingPhoto] = useState<PackingPhoto | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isUrlLoading, setIsUrlLoading] = useState(false);
    const queryClient = useQueryClient();
    const { user } = useAuth();

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
        initialData: null,
    });

    useEffect(() => {
        if(initialPackingPhoto) {
            setPackingPhoto(initialPackingPhoto);
        }
    }, [initialPackingPhoto]);

    useEffect(() => {
        if (packingPhoto?.storage_path) {
            const getSignedUrl = async () => {
                setIsUrlLoading(true);
                const { data, error } = await supabase.storage
                    .from('packing-photos')
                    .createSignedUrl(packingPhoto.storage_path, 300); // 5 minutes validity
                if (error) {
                    console.error("Error creating signed URL:", error);
                    setImageUrl(null);
                } else {
                    setImageUrl(data.signedUrl);
                }
                setIsUrlLoading(false);
            };
            getSignedUrl();
        }
    }, [packingPhoto]);

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
                if (payload.new.ai_analysis_status === 'completed') {
                    queryClient.invalidateQueries({queryKey: ['packingPhoto', orderId, product?.id]});
                }
            }
        )
        .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [packingPhoto?.id, queryClient, orderId, product?.id]);

    const handlePhotoUploaded = (photo: PackingPhoto) => {
        setPackingPhoto(photo);
        setIsPhotoCaptureOpen(false);
    };
    
    const { mutate: markAsPacked, isPending: isPacking } = useMutation({
        mutationFn: async () => {
            const { error } = await supabase.from('orders').update({ status: 'packed' }).eq('id', orderId);
            if (error) throw new Error(error.message);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['orderDetails', orderId] });
            queryClient.invalidateQueries({ queryKey: ['pendingOrders'] });
        },
    });

    if (isLoadingOrder || isLoadingProduct || isLoadingPhoto) {
        return <Skeleton className="h-96 w-full" />;
    }

    if (!order || !product) {
        return <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>Could not load order or product details.</AlertDescription></Alert>;
    }

    const isPacked = order.status === 'packed';
    const canPack = packingPhoto && packingPhoto.ai_analysis_status === 'completed';

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Packing: Order #{order.order_number}</CardTitle>
                </CardHeader>
                <CardContent>
                    <p><strong>Product:</strong> {product.name}</p>
                    <p><strong>Price:</strong> ${product.price}</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>1. Quality Assurance Photo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {packingPhoto ? (
                         <div className="grid md:grid-cols-2 gap-4">
                             <div>
                                <h3 className="font-semibold mb-2">Photo Analysis</h3>
                                <div className="p-4 border rounded-lg bg-muted/50 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <p>Status:</p> <Badge variant={packingPhoto.ai_analysis_status === 'completed' ? 'default' : 'secondary'}>{packingPhoto.ai_analysis_status}</Badge>
                                    </div>
                                    {packingPhoto.ai_analysis_status === 'pending' && <p className="text-sm text-muted-foreground mt-2">Analyzing image, please wait...</p>}
                                    {packingPhoto.ai_analysis_status === 'completed' && (
                                        <div className="mt-2 space-y-1">
                                            <p><strong>Freshness:</strong> {packingPhoto.freshness_score}/10</p>
                                            <p><strong>Quality:</strong> {packingPhoto.quality_score}/10</p>
                                            <p><strong>Description:</strong> {packingPhoto.description}</p>
                                        </div>
                                    )}
                                    {packingPhoto.ai_analysis_status === 'failed' && <p className="text-sm text-red-500 mt-2">Analysis failed. Please try again.</p>}
                                </div>
                             </div>
                            <div>
                                <h3 className="font-semibold mb-2">Captured Image</h3>
                                <div className="p-4 border rounded-lg bg-muted/50 aspect-video flex items-center justify-center">
                                    {isUrlLoading ? <p>Loading image...</p> : imageUrl ? <img src={imageUrl} alt="Packed product" className="max-w-full max-h-full rounded-md" /> : <div className="text-muted-foreground flex flex-col items-center gap-2"><Lock className="h-5 w-5"/><span>Image is private.</span></div>}
                                </div>
                            </div>
                         </div>
                    ) : <p className="text-sm text-muted-foreground">No photo captured yet for this item.</p>}
                   
                    <Dialog open={isPhotoCaptureOpen} onOpenChange={setIsPhotoCaptureOpen}>
                        <DialogTrigger asChild>
                            <Button disabled={!!packingPhoto}>Capture Photo</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl">
                            <DialogHeader>
                                <DialogTitle>Capture Produce Photo</DialogTitle>
                            </DialogHeader>
                            <PhotoCapture orderId={orderId} productId={product.id} onPhotoUploaded={handlePhotoUploaded} />
                        </DialogContent>
                    </Dialog>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>2. Finalize Packing</CardTitle>
                </CardHeader>
                <CardContent>
                    {isPacked ? (
                        <Alert>
                            <CheckCircle className="h-4 w-4" />
                            <AlertTitle>Completed!</AlertTitle>
                            <AlertDescription>This order has been packed.</AlertDescription>
                        </Alert>
                    ) : (
                        <Button onClick={() => markAsPacked()} disabled={!canPack || isPacking}>
                            {isPacking ? "Packing..." : "Mark as Packed"}
                        </Button>
                    )}
                    {!canPack && !isPacked && <p className="text-sm text-muted-foreground mt-2">You must capture a photo and wait for analysis to complete before packing.</p>}
                </CardContent>
            </Card>
        </div>
    );
};

export default PackingWorkflow;
