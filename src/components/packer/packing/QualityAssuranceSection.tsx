
import { useState } from 'react';
import { Tables } from '@/integrations/supabase/types';
import PhotoCapture from '../PhotoCapture';
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

type Product = Tables<'products'>;
type PackingPhoto = Tables<'packing_photos'>;

interface QualityAssuranceSectionProps {
    orderId: string;
    product: Product;
    packingPhoto: PackingPhoto | null;
    onPhotoUploaded: (photo: PackingPhoto) => void;
}

const QualityAssuranceSection = ({ orderId, product, packingPhoto, onPhotoUploaded }: QualityAssuranceSectionProps) => {
    const [isPhotoCaptureOpen, setIsPhotoCaptureOpen] = useState(false);

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
                     <div className="grid md:grid-cols-2 gap-4">
                        <PhotoAnalysis packingPhoto={packingPhoto} />
                        <CapturedImage packingPhoto={packingPhoto} />
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
    );
}

export default QualityAssuranceSection;
