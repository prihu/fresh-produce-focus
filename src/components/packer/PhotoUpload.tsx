
import { useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Upload, Loader2 } from 'lucide-react';
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
const TARGET_SIZE_MB = 2; // Compress to 2MB for faster processing

const PhotoUpload = ({ orderId, productId, onPhotoUploaded, isUploading = false, onUploadingChange }: PhotoUploadProps) => {
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const compressImage = (file: File, maxSizeMB: number, quality: number = 0.7): Promise<Blob> => {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                // Calculate new dimensions to reduce file size
                const maxWidth = 1920;
                const maxHeight = 1080;
                let { width, height } = img;
                
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }
                
                canvas.width = width;
                canvas.height = height;
                ctx?.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    if (blob && blob.size > maxSizeMB * 1024 * 1024 && quality > 0.1) {
                        // Recursively reduce quality if still too large
                        canvas.toBlob((newBlob) => {
                            resolve(newBlob || blob);
                        }, 'image/webp', quality - 0.1);
                    } else {
                        resolve(blob || new Blob());
                    }
                }, 'image/webp', quality);
            };
            
            img.src = URL.createObjectURL(file);
        });
    };

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

        onUploadingChange?.(true);
        
        try {
            toast({
                title: "Processing Image",
                description: "Optimizing image for analysis...",
            });

            // Compress the image for faster processing
            const compressedBlob = await compressImage(file, TARGET_SIZE_MB);
            const fileName = `${orderId}/${uuidv4()}.webp`;

            toast({
                title: "Uploading",
                description: "Uploading optimized image...",
            });

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('packing-photos')
                .upload(fileName, compressedBlob);

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

            toast({ 
                title: "Upload Successful", 
                description: "Starting AI analysis... This will take 30-60 seconds." 
            });

            // Invoke edge function for analysis with retry logic
            const invokeAnalysis = async (retryCount = 0): Promise<void> => {
                try {
                    const { error } = await supabase.functions.invoke('analyze-image', {
                        body: { packing_photo_id: photoRecord.id },
                    });
                    
                    if (error) throw error;
                } catch (error: any) {
                    if (retryCount < 2) {
                        console.log(`Analysis invocation failed, retrying... (${retryCount + 1}/3)`);
                        setTimeout(() => invokeAnalysis(retryCount + 1), 2000 * (retryCount + 1));
                    } else {
                        console.error('Analysis invocation failed after 3 attempts:', error);
                        toast({
                            title: "Analysis Failed to Start",
                            description: "You can retry the analysis manually.",
                            variant: "destructive",
                        });
                    }
                }
            };

            await invokeAnalysis();
            onPhotoUploaded(photoRecord);
            
            // Clear the input
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
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
                {isUploading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin"/> 
                        Processing...
                    </>
                ) : (
                    <>
                        <Upload className="mr-2 h-4 w-4"/> 
                        Upload Photo
                    </>
                )}
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
