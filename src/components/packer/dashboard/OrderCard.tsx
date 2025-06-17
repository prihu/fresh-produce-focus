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
import { ModernSkeleton } from "@/components/ui/modern-skeleton";
import { cn } from "@/lib/utils";

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
                <Badge variant="outline" className="border-gray-200 text-gray-600 bg-gray-50">
                    <Camera className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">No Photos</span>
                    <span className="sm:hidden">No Pics</span>
                </Badge>
            );
        }

        const completedPhotos = photos.filter(p => p.ai_analysis_status === 'completed');
        const pendingPhotos = photos.filter(p => p.ai_analysis_status === 'pending');
        const failedPhotos = photos.filter(p => p.ai_analysis_status === 'failed');

        if (failedPhotos.length > 0) {
            return (
                <Badge variant="destructive" className="bg-red-50 text-red-700 border-red-200">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">Analysis Failed</span>
                    <span className="sm:hidden">Failed</span>
                </Badge>
            );
        }

        if (pendingPhotos.length > 0) {
            return (
                <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200">
                    <Clock className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">Analyzing...</span>
                    <span className="sm:hidden">Analyzing</span>
                </Badge>
            );
        }

        if (completedPhotos.length > 0) {
            const avgFreshness = completedPhotos.reduce((sum, p) => sum + (p.freshness_score || 0), 0) / completedPhotos.length;
            const avgQuality = completedPhotos.reduce((sum, p) => sum + (p.quality_score || 0), 0) / completedPhotos.length;
            const avgScore = (avgFreshness + avgQuality) / 2;
            
            return (
                <Badge className="bg-green-50 text-green-700 border-green-200">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">Score: {avgScore.toFixed(1)}/10</span>
                    <span className="sm:hidden">{avgScore.toFixed(1)}/10</span>
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
            <div className="flex items-center gap-3 text-xs text-gray-600 mt-3">
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="font-medium">Fresh: {avgFreshness.toFixed(1)}</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="font-medium">Quality: {avgQuality.toFixed(1)}</span>
                </div>
            </div>
        );
    };

    if (isLoading) {
        return (
            <Card className="bg-white border-subtle shadow-sm">
                <CardHeader className="pb-3">
                    <ModernSkeleton variant="wave" className="h-5 w-32" />
                    <ModernSkeleton variant="wave" className="h-4 w-20" />
                </CardHeader>
                <CardContent className="pb-3">
                    <ModernSkeleton variant="wave" lines={3} />
                </CardContent>
                <CardFooter>
                    <ModernSkeleton variant="wave" className="h-11 w-full" />
                </CardFooter>
            </Card>
        );
    }

    return (
        <Card className="bg-white border-subtle shadow-sm hover:shadow-md hover:border-medium card-interactive group">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <CardTitle className="text-heading-primary text-base sm:text-lg truncate">
                            Order #{order.order_number}
                        </CardTitle>
                        {order.manually_created && (
                            <Badge variant="secondary" className="mt-2 text-xs bg-gray-100 text-gray-700">
                                Manual
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {getAnalysisStatusBadge()}
                        {canDelete && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                        disabled={isDeleting}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        <span className="sr-only">Delete order</span>
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="rounded-2xl">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="text-heading-primary">Delete Order</AlertDialogTitle>
                                        <AlertDialogDescription className="text-body-secondary">
                                            Are you sure you want to delete order #{order.order_number}? This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="gap-2">
                                        <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                                        <AlertDialogAction 
                                            onClick={handleDelete} 
                                            className="bg-red-600 hover:bg-red-700 rounded-xl"
                                        >
                                            Delete
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                </div>
            </CardHeader>
            
            <CardContent className="pb-4">
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-body-secondary font-medium">Status:</span>
                        <span className={cn(
                            "px-2 py-1 rounded-md text-xs font-medium",
                            order.status === 'packed' 
                                ? "bg-green-100 text-green-700" 
                                : "bg-yellow-100 text-yellow-700"
                        )}>
                            {order.status === 'packed' ? 'Completed' : 'Pending'}
                        </span>
                    </div>
                    
                    <div className="text-sm text-body-secondary">
                        <span className="font-medium">
                            {order.status === 'packed' ? 'Packed' : 'Received'}: 
                        </span>
                        <span className="ml-1">
                            {new Date(order.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </span>
                    </div>
                    
                    {photos.length > 0 && (
                        <div className="space-y-3 pt-2 border-t border-subtle">
                            <div className="flex items-center gap-2 text-sm text-body-secondary">
                                <Camera className="h-4 w-4 text-gray-400" />
                                <span className="font-medium">
                                    {photos.length} photo{photos.length > 1 ? 's' : ''}
                                </span>
                            </div>
                            
                            {/* Enhanced photo thumbnails for mobile */}
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {photos.slice(0, 4).map((photo) => (
                                    <div key={photo.id} className="flex-shrink-0">
                                        <EnhancedImage
                                            storagePath={photo.storage_path}
                                            alt="Packing photo"
                                            className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg border border-subtle hover:border-medium transition-colors"
                                            fallbackClassName="w-14 h-14 sm:w-16 sm:h-16"
                                            onError={(error) => console.error('OrderCard image error:', error)}
                                        />
                                    </div>
                                ))}
                                {photos.length > 4 && (
                                    <div className="flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 bg-gray-50 rounded-lg border border-subtle flex items-center justify-center">
                                        <span className="text-xs text-gray-500 font-medium">+{photos.length - 4}</span>
                                    </div>
                                )}
                            </div>
                            
                            {getQualityIndicator()}
                        </div>
                    )}
                </div>
            </CardContent>
            
            <CardFooter className="pt-0">
                <Button asChild className="w-full touch-target">
                    <Link to={`/packer/${order.id}`}>
                        {order.status === 'packed' ? 'View Details' : 'Start Packing'}
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    );
};

export default OrderCard;
