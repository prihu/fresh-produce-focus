
import { useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';
import { useCamera } from '@/hooks/useCamera';
import { usePhotoUpload } from '@/hooks/usePhotoUpload';
import CameraView from './photo-capture/CameraView';
import ImagePreview from './photo-capture/ImagePreview';

type PackingPhoto = Tables<'packing_photos'>;

interface PhotoCaptureProps {
    orderId: string;
    productId: string;
    onPhotoUploaded: (photo: PackingPhoto) => void;
}

const MAX_FILE_SIZE_MB = 15;

const PhotoCapture = ({ orderId, productId, onPhotoUploaded }: PhotoCaptureProps) => {
    const { toast } = useToast();
    const videoRef = useRef<HTMLVideoElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);

    const { stream, startCamera, stopCamera, captureImage, canvasRef } = useCamera(videoRef);
    const { uploadPhoto, isUploading } = usePhotoUpload({ orderId, productId, onPhotoUploaded });

    useEffect(() => {
        if (!capturedImage) {
            startCamera();
        }
        return () => {
            stopCamera();
        };
    }, [capturedImage, startCamera, stopCamera]);

    const handleCapture = () => {
        const image = captureImage();
        if (image) {
            setCapturedImage(image);
        }
    };
    
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
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

            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setCapturedImage(reader.result as string);
                    stopCamera();
                };
                reader.readAsDataURL(file);
            } else {
                toast({
                    title: "Invalid File Type",
                    description: "Please select an image file.",
                    variant: "destructive",
                });
            }
        }
    };

    const handleRetake = () => {
        setCapturedImage(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleUpload = async () => {
        if (capturedImage) {
            await uploadPhoto(capturedImage);
        }
    };
    
    return (
        <div className="flex flex-col items-center space-y-4">
            {capturedImage ? (
                <ImagePreview 
                    image={capturedImage}
                    isUploading={isUploading}
                    onRetake={handleRetake}
                    onUpload={handleUpload}
                />
            ) : (
                <CameraView
                    videoRef={videoRef}
                    canvasRef={canvasRef}
                    stream={stream}
                    onCapture={handleCapture}
                    onUploadClick={() => fileInputRef.current?.click()}
                />
            )}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
            />
        </div>
    );
};

export default PhotoCapture;
