import { useState } from 'react';
import { Tables } from '@/integrations/supabase/types';
import PhotoCapture from '../PhotoCapture';
import PhotoUpload from '../PhotoUpload';
import PhotoAnalysis from './PhotoAnalysis';
import CapturedImage from './CapturedImage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Product = Tables<'products'>;
type PackingPhoto = Tables<'packing_photos'>;

interface QualityAssuranceSectionProps {
    orderId: string;
    product: Product;
    packingPhoto: PackingPhoto | null;
    onPhotoUploaded: (photo: PackingPhoto) => void;
    onPhotoDeleted: () => void;
}

const QualityAssuranceSection = ({ orderId, product, packingPhoto, onPhotoUploaded, onPhotoDeleted }: QualityAssuranceSectionProps) => {
    const [isPhotoCaptureOpen, setIsPhotoCaptureOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const queryClient = useQueryClient();

    // Disable photo delete if order is already "packed"
    const isPacked = packingPhoto ? packingPhoto.ai_analysis_status === "completed" && (packingPhoto.quality_score ?? 0) < 5 : false;

    // We need to fetch the order status to disable the delete button when packed
    // For compactness, assume the parent workflow already provides order status if needed

    const { mutate: deletePhoto, isPending: isDeleting } = useMutation({
        mutationFn: async (photoToDelete: PackingPhoto) => {
            if (!photoToDelete) throw new Error("No photo to delete.");
            
            const { error: storageError } = await supabase.storage
                .from('packing-photos')
                .remove([photoToDelete.storage_path]);
            
            if (storageError) {
                console.error("Storage deletion failed, but proceeding to delete DB record:", storageError);
                toast.warning("Could not delete photo file, but record will be removed.");
            }

            const { error: dbError } = await supabase
                .from('packing_photos')
                .delete()
                .eq('id', photoToDelete.id);
            
            if (dbError) throw dbError;
        },
        onSuccess: () => {
            toast.success("Photo deleted successfully.");
            onPhotoDeleted();
            queryClient.invalidateQueries({ queryKey: ['packingPhoto', orderId, product.id] });
        },
        onError: (error: any) => {
            toast.error(`Failed to delete photo: ${error.message}`);
        }
    });

    const handleDeleteClick = () => {
        if (packingPhoto) {
            deletePhoto(packingPhoto);
        }
    };

    const handlePhotoUploaded = (photo: PackingPhoto) => {
        onPhotoUploaded(photo);
        setIsPhotoCaptureOpen(false);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>1. Quality Assurance Photo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {packingPhoto ? (
                     <div className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <PhotoAnalysis packingPhoto={packingPhoto} />
                            <CapturedImage packingPhoto={packingPhoto} />
                        </div>
                        <Button 
                          onClick={handleDeleteClick} 
                          disabled={isDeleting || (packingPhoto && packingPhoto.order_status === "packed")}
                          variant="destructive" 
                          size="sm"
                        >
                            {isDeleting ? "Deleting..." : "Delete and Retake"}
                        </Button>
                     </div>
                ) : (
                    <>
                        <p className="text-sm text-muted-foreground">No photo captured yet for this item.</p>
                        
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Dialog open={isPhotoCaptureOpen} onOpenChange={setIsPhotoCaptureOpen}>
                                <DialogTrigger asChild>
                                    <Button>Capture Photo</Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl">
                                    <DialogHeader>
                                        <DialogTitle>Capture Produce Photo</DialogTitle>
                                    </DialogHeader>
                                    <PhotoCapture orderId={orderId} productId={product.id} onPhotoUploaded={handlePhotoUploaded} />
                                </DialogContent>
                            </Dialog>
                            
                            <PhotoUpload 
                                orderId={orderId} 
                                productId={product.id} 
                                onPhotoUploaded={onPhotoUploaded}
                                isUploading={isUploading}
                                onUploadingChange={setIsUploading}
                            />
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

export default QualityAssuranceSection;
