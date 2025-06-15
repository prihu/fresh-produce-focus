
import { useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';
import { useCamera } from '@/hooks/useCamera';
import { usePhotoUpload } from '@/hooks/usePhotoUpload';
import CameraView from './photo-capture/CameraView';
import ImagePreview from './photo-capture/ImagePreview';
import { Button } from '@/components/ui/button';
import { Camera, Upload, RefreshCw, Check } from 'lucide-react';

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

    const { stream, startCamera, stopCamera, captureImage, canvasRef, isLoading, error } = useCamera(videoRef);
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
                <ImagePreview image={capturedImage} />
            ) : (
                <CameraView
                    videoRef={videoRef}
                    canvasRef={canvasRef}
                    isLoading={isLoading}
                    error={error}
                />
            )}

            <div className="flex space-x-4">
                {capturedImage ? (
                    <>
                        <Button onClick={handleRetake} variant="outline" disabled={isUploading}>
                            <RefreshCw className="mr-2 h-4 w-4" /> Retake
                        </Button>
                        <Button onClick={handleUpload} disabled={isUploading}>
                            {isUploading ? "Uploading..." : <><Check className="mr-2 h-4 w-4" /> Confirm & Upload</>}
                        </Button>
                    </>
                ) : (
                    <>
                        <Button onClick={handleCapture} disabled={!stream || isLoading || !!error}>
                            <Camera className="mr-2 h-4 w-4" /> Capture
                        </Button>
                        <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isLoading || !!error}>
                            <Upload className="mr-2 h-4 w-4"/> Upload Photo
                        </Button>
                    </>
                )}
            </div>

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
