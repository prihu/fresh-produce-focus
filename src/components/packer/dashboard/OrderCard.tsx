
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tables } from "@/integrations/supabase/types";
import { Camera, CheckCircle2, Clock, AlertCircle, Star } from "lucide-react";

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

    return (
        <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="bg-white pb-3">
                <div className="flex items-start justify-between">
                    <CardTitle className="text-gray-900">Order #{order.order_number}</CardTitle>
                    {getAnalysisStatusBadge()}
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
                            
                            {/* Photo thumbnails */}
                            <div className="flex gap-2 overflow-x-auto">
                                {photos.slice(0, 3).map((photo) => (
                                    <div key={photo.id} className="flex-shrink-0">
                                        <img
                                            src={`${supabase.storage.from('packing-photos').getPublicUrl(photo.storage_path).data.publicUrl}`}
                                            alt="Packing photo"
                                            className="w-16 h-16 object-cover rounded border border-gray-200"
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
