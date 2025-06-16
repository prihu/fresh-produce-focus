
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tables } from "@/integrations/supabase/types";
import { useSecurePhotoUpload } from "@/hooks/useSecurePhotoUpload";
import PhotoCapture from "../PhotoCapture";
import CapturedImage from "./CapturedImage";
import PhotoAnalysis from "./PhotoAnalysis";

type Product = Tables<'products'>;
type PackingPhoto = Tables<'packing_photos'>;

interface QualityAssuranceSectionProps {
    orderId: string;
    product: Product;
    packingPhoto: PackingPhoto | null;
    orderStatus: string;
    onPhotoUploaded: (photo: PackingPhoto) => void;
    onPhotoDeleted: () => void;
    onPhotoStatusUpdate: (photo: PackingPhoto) => void;
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
    const { uploadPhoto, isUploading } = useSecurePhotoUpload({
        orderId,
        productId: product.id,
        onPhotoUploaded,
    });

    const isPacked = orderStatus === 'packed';

    return (
        <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader className="bg-white">
                <CardTitle className="text-gray-900">1. Quality Assurance</CardTitle>
            </CardHeader>
            <CardContent className="bg-white space-y-4">
                <div className="text-sm text-gray-600">
                    <p className="mb-2">Capture a photo of <strong>{product.name}</strong> for AI quality analysis.</p>
                    <div className="text-xs space-y-1 bg-blue-50 p-2 rounded border border-blue-200">
                        <p><strong>Quality Standards:</strong></p>
                        <ul className="list-disc list-inside space-y-1 text-blue-700">
                            <li>Must be identifiable produce/food item</li>
                            <li>Minimum quality score: 6/10</li>
                            <li>Minimum freshness score: 6/10</li>
                        </ul>
                    </div>
                </div>

                {!packingPhoto ? (
                    <PhotoCapture
                        onCapture={uploadPhoto}
                        isUploading={isUploading}
                        disabled={isPacked}
                    />
                ) : (
                    <div className="space-y-4">
                        <CapturedImage 
                            packingPhoto={packingPhoto}
                            onPhotoDeleted={onPhotoDeleted}
                            disabled={isPacked}
                        />
                        <PhotoAnalysis 
                            packingPhoto={packingPhoto}
                            onStatusUpdate={onPhotoStatusUpdate}
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default QualityAssuranceSection;
