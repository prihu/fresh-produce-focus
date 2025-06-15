
import { useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

type PackingPhoto = Tables<'packing_photos'>;

interface PhotoUploadProps {
    orderId: string;
    productId: string;
    onPhotoUploaded: (photo: PackingPhoto) => void;
    isUploading?: boolean;
    onUploadingChange?: (uploading: boolean) => void;
}

const MAX_FILE_SIZE_MB = 15;

const PhotoUpload = ({ orderId, productId, onPhotoUploaded, isUploading = false, onUploadingChange }: PhotoUploadProps) => {
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            toast({
                title: "File Too Large",
                description: `Please select an image smaller than ${MAX_FILE_SIZE_MB}MB.`,
                variant: "destructive",
            });
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
            return;
        }

        if (!file.type.startsWith('image/')) {
            toast({
                title: "Invalid File Type",
                description: "Please select an image file.",
                variant: "destructive",
            });
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
            return;
        }

        // Upload the file
        onUploadingChange?.(true);
        try {
            const fileName = `${orderId}/${uuidv4()}.webp`;

            // Convert to webp format for consistency
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = async () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx?.drawImage(img, 0, 0);
                
                canvas.toBlob(async (blob) => {
                    if (!blob) {
                        toast({
                            title: "Upload Failed",
                            description: "Failed to process image.",
                            variant: "destructive",
                        });
                        onUploadingChange?.(false);
                        return;
                    }

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

                    // Invoke edge function for analysis
                    await supabase.functions.invoke('analyze-image', {
                        body: { packing_photo_id: photoRecord.id },
                    });

                    onPhotoUploaded(photoRecord);
                    
                    // Clear the input
                    if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                    }
                }, 'image/webp', 0.8);
            };
            
            img.src = URL.createObjectURL(file);
        } catch (error: any) {
            toast({
                title: "Upload Failed",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            onUploadingChange?.(false);
        }
    };

    return (
        <>
            <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isUploading}
            >
                <Upload className="mr-2 h-4 w-4"/> 
                {isUploading ? "Uploading..." : "Upload Photo"}
            </Button>
            
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
            />
        </>
    );
};

export default PhotoUpload;
