
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tables } from "@/integrations/supabase/types";
import PhotoUpload from "../PhotoUpload";
import PhotoCapture from "../PhotoCapture";
import PhotoAnalysis from "./PhotoAnalysis";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Trash2, Upload, Camera, CheckCircle2, ImageIcon } from "lucide-react";

type Product = Tables<'products'>;
type PackingPhoto = Tables<'packing_photos'>;

interface QualityAssuranceSectionProps {
    orderId: string;
    product: Product;
    packingPhoto: PackingPhoto | null;
    orderStatus: string;
    onPhotoUploaded: (photo: PackingPhoto) => void;
    onPhotoDeleted: () => void;
    onPhotoStatusUpdate?: (photo: PackingPhoto) => void;
}

const QualityAssuranceSection = ({ 
    orderId, 
    product, 
    packingPhoto, 
    orderStatus, 
    onPhotoUploaded, 
    onPhotoDeleted,
    onPhotoStatusUpdate 
}: QualityAssuranceSectionProps) => {
    const { toast } = useToast();
    const [isUploading, setIsUploading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [imageError, setImageError] = useState(false);

    const handleDeletePhoto = async () => {
        if (!packingPhoto) return;
        setIsDeleting(true);

        try {
            // Delete from storage first
            const { error: storageError } = await supabase.storage
                .from('packing-photos')
                .remove([packingPhoto.storage_path]);

            if (storageError) {
                console.warn('Storage deletion warning:', storageError);
            }

            // Delete from database
            const { error: dbError } = await supabase
                .from('packing_photos')
                .delete()
                .eq('id', packingPhoto.id);

            if (dbError) throw dbError;

            toast({
                title: "Photo Deleted",
                description: "The quality check photo has been removed.",
            });

            onPhotoDeleted();
        } catch (error: any) {
            toast({
                title: "Delete Failed",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const getQualityStatusIcon = () => {
        if (!packingPhoto) return <Upload className="h-5 w-5 text-purple-600" />;
        
        switch (packingPhoto.ai_analysis_status) {
            case 'completed':
                return <CheckCircle2 className="h-5 w-5 text-green-600" />;
            case 'failed':
                return <Upload className="h-5 w-5 text-red-600" />;
            default:
                return <Camera className="h-5 w-5 text-purple-600 animate-pulse" />;
        }
    };

    const getQualityStatusText = () => {
        if (!packingPhoto) return "No quality check performed";
        
        switch (packingPhoto.ai_analysis_status) {
            case 'completed':
                const avgScore = ((packingPhoto.freshness_score || 0) + (packingPhoto.quality_score || 0)) / 2;
                return `Quality verified - Average score: ${avgScore.toFixed(1)}/10`;
            case 'failed':
                return "Quality check failed - Please retry";
            case 'pending':
                return "AI analysis in progress...";
            default:
                return "Quality check pending";
        }
    };

    // Generate the image URL with error handling
    const getImageUrl = () => {
        if (!packingPhoto) return null;
        
        try {
            const url = supabase.storage
                .from('packing-photos')
                .getPublicUrl(packingPhoto.storage_path).data.publicUrl;
            
            console.log('Generated image URL:', url);
            return url;
        } catch (error) {
            console.error('Error generating image URL:', error);
            return null;
        }
    };

    const handleImageError = () => {
        console.error('Failed to load image:', packingPhoto?.storage_path);
        setImageError(true);
    };

    const handleImageLoad = () => {
        console.log('Image loaded successfully:', packingPhoto?.storage_path);
        setImageError(false);
    };

    return (
        <Card className="bg-white border-purple-200 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {getQualityStatusIcon()}
                        <div>
                            <CardTitle className="text-gray-800">Produce Quality Assessment</CardTitle>
                            <CardDescription className="text-gray-600">
                                {getQualityStatusText()}
                            </CardDescription>
                        </div>
                    </div>
                    {packingPhoto && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDeletePhoto}
                            disabled={isDeleting || orderStatus === 'packed'}
                            className="border-red-300 text-red-700 hover:bg-red-50"
                        >
                            {isDeleting ? (
                                "Removing..."
                            ) : (
                                <>
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Remove
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </CardHeader>

            <CardContent className="p-6 bg-white">
                {packingPhoto ? (
                    <div className="space-y-4">
                        {/* Display the uploaded image with error handling */}
                        <div className="flex justify-center">
                            <div className="relative max-w-md w-full">
                                {!imageError && getImageUrl() ? (
                                    <img
                                        src={getImageUrl()!}
                                        alt="Uploaded produce"
                                        className="w-full h-auto rounded-lg border border-purple-200 shadow-sm"
                                        onError={handleImageError}
                                        onLoad={handleImageLoad}
                                    />
                                ) : (
                                    <div className="w-full h-48 bg-gray-100 rounded-lg border border-purple-200 flex items-center justify-center">
                                        <div className="text-center text-gray-500">
                                            <ImageIcon className="h-12 w-12 mx-auto mb-2" />
                                            <p className="text-sm">Image loading failed</p>
                                            <p className="text-xs">Please try re-uploading</p>
                                        </div>
                                    </div>
                                )}
                                <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-medium text-purple-700">
                                    Quality Check Photo
                                </div>
                            </div>
                        </div>

                        {/* Analysis results */}
                        <PhotoAnalysis 
                            packingPhoto={packingPhoto} 
                            onStatusUpdate={onPhotoStatusUpdate}
                        />
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="text-center py-6 bg-purple-50 rounded-lg border-2 border-dashed border-purple-200">
                            <Upload className="h-12 w-12 text-purple-400 mx-auto mb-3" />
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">
                                Quality Check Required
                            </h3>
                            <p className="text-gray-600 text-sm mb-4">
                                Take or upload a photo of the produce for AI quality analysis
                            </p>
                        </div>

                        <Tabs defaultValue="upload" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 bg-purple-100">
                                <TabsTrigger value="upload" className="data-[state=active]:bg-white data-[state=active]:text-purple-700">
                                    <Upload className="h-4 w-4 mr-2" />
                                    Upload Photo
                                </TabsTrigger>
                                <TabsTrigger value="capture" className="data-[state=active]:bg-white data-[state=active]:text-purple-700">
                                    <Camera className="h-4 w-4 mr-2" />
                                    Take Photo
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="upload" className="mt-4">
                                <div className="flex justify-center">
                                    <PhotoUpload
                                        orderId={orderId}
                                        productId={product.id}
                                        onPhotoUploaded={onPhotoUploaded}
                                        isUploading={isUploading}
                                        onUploadingChange={setIsUploading}
                                    />
                                </div>
                            </TabsContent>

                            <TabsContent value="capture" className="mt-4">
                                <PhotoCapture
                                    orderId={orderId}
                                    productId={product.id}
                                    onPhotoUploaded={onPhotoUploaded}
                                />
                            </TabsContent>
                        </Tabs>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default QualityAssuranceSection;
