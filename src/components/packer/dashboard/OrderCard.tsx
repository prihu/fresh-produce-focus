import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tables } from "@/integrations/supabase/types";
import { Camera, CheckCircle2, Clock, AlertCircle, Star, Trash2 } from "lucide-react";
import EnhancedImage from "@/components/ui/enhanced-image";
import { useDeleteOrder } from "@/hooks/useDeleteOrder";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

type Order = Tables<'orders'>;
type PackingPhoto = Tables<'packing_photos'>;

interface OrderCardProps {
    order: Order;
}

const fetchOrderPhotos = async (orderId: string): Promise<PackingPhoto[]> => {
    const { data, error } = await supabase
        .from("packing_photos")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
    
    if (error) throw new Error(error.message);
    return data || [];
};

const OrderCard = ({ order }: OrderCardProps) => {
    const { data: photos = [], isLoading } = useQuery({
        queryKey: ["orderPhotos", order.id],
        queryFn: () => fetchOrderPhotos(order.id),
    });

    const { mutate: deleteOrder, isPending: isDeleting } = useDeleteOrder();

    const canDelete = order.manually_created && order.status !== 'packed';

    const handleDelete = () => {
        deleteOrder(order.id);
    };

    const getAnalysisStatusBadge = () => {
        if (!photos.length) {
            return (
                <Badge variant="outline" className="text-gray-600 border-gray-300">
                    <Camera className="h-3 w-3 mr-1" />
                    No Photos
                </Badge>
            );
        }

        const completedPhotos = photos.filter(p => p.ai_analysis_status === 'completed');
        const pendingPhotos = photos.filter(p => p.ai_analysis_status === 'pending');
        const failedPhotos = photos.filter(p => p.ai_analysis_status === 'failed');

        if (failedPhotos.length > 0) {
            return (
                <Badge variant="destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Analysis Failed
                </Badge>
            );
        }

        if (pendingPhotos.length > 0) {
            return (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                    <Clock className="h-3 w-3 mr-1" />
                    Analyzing...
                </Badge>
            );
        }

        if (completedPhotos.length > 0) {
            const avgFreshness = completedPhotos.reduce((sum, p) => sum + (p.freshness_score || 0), 0) / completedPhotos.length;
            const avgQuality = completedPhotos.reduce((sum, p) => sum + (p.quality_score || 0), 0) / completedPhotos.length;
            const avgScore = (avgFreshness + avgQuality) / 2;
            
            return (
                <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Score: {avgScore.toFixed(1)}/10
                </Badge>
            );
        }

        return null;
    };

    const getQualityIndicator = () => {
        const completedPhotos = photos.filter(p => p.ai_analysis_status === 'completed');
        if (!completedPhotos.length) return null;

        const avgFreshness = completedPhotos.reduce((sum, p) => sum + (p.freshness_score || 0), 0) / completedPhotos.length;
        const avgQuality = completedPhotos.reduce((sum, p) => sum + (p.quality_score || 0), 0) / completedPhotos.length;
        
        return (
            <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-green-600" />
                    <span>Freshness: {avgFreshness.toFixed(1)}</span>
                </div>
                <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-blue-600" />
                    <span>Quality: {avgQuality.toFixed(1)}</span>
                </div>
            </div>
        );
    };

    if (isLoading) {
        return (
            <Card className="bg-white border-gray-200 shadow-sm">
                <CardHeader className="bg-white pb-3">
                    <div className="animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                </CardHeader>
                <CardContent className="bg-white pb-3">
                    <div className="animate-pulse space-y-2">
                        <div className="h-3 bg-gray-200 rounded w-full"></div>
                        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="bg-white pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <CardTitle className="text-gray-900">Order #{order.order_number}</CardTitle>
                        {order.manually_created && (
                            <Badge variant="secondary" className="mt-1 text-xs">Manual</Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {getAnalysisStatusBadge()}
                        {canDelete && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        disabled={isDeleting}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Order</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Are you sure you want to delete order #{order.order_number}? This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                                            Delete
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                </div>
            </CardHeader>
            
            <CardContent className="bg-white pb-3">
                <div className="space-y-2">
                    <p className="text-sm text-gray-700">Status: {order.status}</p>
                    <p className="text-sm text-gray-700">
                        {order.status === 'packed' ? 'Packed' : 'Received'}: {new Date(order.created_at).toLocaleString()}
                    </p>
                    
                    {photos.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Camera className="h-4 w-4" />
                                <span>{photos.length} photo{photos.length > 1 ? 's' : ''} uploaded</span>
                            </div>
                            
                            {/* Photo thumbnails using enhanced image component */}
                            <div className="flex gap-2 overflow-x-auto">
                                {photos.slice(0, 3).map((photo) => (
                                    <div key={photo.id} className="flex-shrink-0">
                                        <EnhancedImage
                                            storagePath={photo.storage_path}
                                            alt="Packing photo"
                                            className="w-16 h-16 object-cover rounded border border-gray-200"
                                            fallbackClassName="w-16 h-16"
                                            onError={(error) => console.error('OrderCard image error:', error)}
                                        />
                                    </div>
                                ))}
                                {photos.length > 3 && (
                                    <div className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded border border-gray-200 flex items-center justify-center">
                                        <span className="text-xs text-gray-600">+{photos.length - 3}</span>
                                    </div>
                                )}
                            </div>
                            
                            {getQualityIndicator()}
                        </div>
                    )}
                </div>
            </CardContent>
            
            <CardFooter className="bg-white">
                <Button asChild className="w-full">
                    <Link to={`/packer/${order.id}`}>
                        {order.status === 'packed' ? 'View Details' : 'Start Packing'}
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    );
};

export default OrderCard;
