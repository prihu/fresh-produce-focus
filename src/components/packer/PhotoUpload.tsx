import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';
type PackingPhoto = Tables<'packing_photos'>;
import { useSecurePhotoUpload } from '@/hooks/useSecurePhotoUpload';

interface PhotoUploadProps {
    orderId: string;
    productId: string;
    onPhotoUploaded: (photo: PackingPhoto) => void;
}

const PhotoUpload = ({ orderId, productId, onPhotoUploaded }: PhotoUploadProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { uploadPhoto, isUploading } = useSecurePhotoUpload({ orderId, productId, onPhotoUploaded });
    const { toast } = useToast();
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            toast({
                title: "No file selected",
                description: "Please select an image to upload.",
                variant: "destructive",
            });
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            setPreviewImage(base64String);
            uploadPhoto(base64String);
        };
        reader.onerror = () => {
            toast({
                title: "Error reading file",
                description: "Could not read the selected file.",
                variant: "destructive",
            });
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="space-y-4">
            <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                ref={fileInputRef}
            />
            <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
            >
                <Camera className="mr-2 h-4 w-4" />
                {isUploading ? "Uploading..." : "Upload Photo"}
            </Button>
            {previewImage && (
                <div>
                    <img
                        src={previewImage}
                        alt="Preview"
                        className="max-w-full h-auto rounded-md"
                    />
                </div>
            )}
        </div>
    );
};

export default PhotoUpload;
