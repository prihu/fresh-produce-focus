
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { Tables } from '@/integrations/supabase/types';

type PackingPhoto = Tables<'packing_photos'>;

interface UsePhotoUploadProps {
    orderId: string;
    productId: string;
    onPhotoUploaded: (photo: PackingPhoto) => void;
}

export const usePhotoUpload = ({ orderId, productId, onPhotoUploaded }: UsePhotoUploadProps) => {
    const { toast } = useToast();
    const [isUploading, setIsUploading] = useState(false);

    const uploadPhoto = async (image: string) => {
        if (!image) return;
        setIsUploading(true);

        try {
            const blob = await (await fetch(image)).blob();
            const fileName = `${orderId}/${uuidv4()}.webp`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('packing-photos')
                .upload(fileName, blob);
            
            if (uploadError) throw uploadError;

            const { data: photoRecord, error: insertError } = await supabase
                .from('packing_photos')
                .insert({
                    order_id: orderId,
                    product_id: productId,
                    storage_path: uploadData.path,
                })
                .select()
                .single();
            
            if (insertError) throw insertError;
            
            toast({ title: "Success", description: "Photo uploaded and analysis started." });

            await supabase.functions.invoke('analyze-image', {
                body: { packing_photo_id: photoRecord.id },
            });
            
            onPhotoUploaded(photoRecord);

        } catch (error: any) {
            toast({
                title: "Upload Failed",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setIsUploading(false);
        }
    };

    return { uploadPhoto, isUploading };
};
