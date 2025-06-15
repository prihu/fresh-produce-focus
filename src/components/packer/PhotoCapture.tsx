
import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { Camera, Upload, Check, RefreshCw } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';

type PackingPhoto = Tables<'packing_photos'>;

interface PhotoCaptureProps {
    orderId: string;
    productId: string;
    onPhotoUploaded: (photo: PackingPhoto) => void;
}

const PhotoCapture = ({ orderId, productId, onPhotoUploaded }: PhotoCaptureProps) => {
    const { toast } = useToast();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const startCamera = useCallback(async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            toast({
                title: "Camera Error",
                description: "Could not access camera. Please check permissions.",
                variant: "destructive",
            });
        }
    }, [toast]);

    useEffect(() => {
        startCamera();
        return () => {
            stream?.getTracks().forEach(track => track.stop());
        };
    }, [startCamera, stream]);

    const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            context?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
            setCapturedImage(canvas.toDataURL('image/webp', 0.8));
            stream?.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const handleRetake = () => {
        setCapturedImage(null);
        startCamera();
    };

    const handleUpload = async () => {
        if (!capturedImage) return;
        setIsUploading(true);

        try {
            const blob = await (await fetch(capturedImage)).blob();
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

            // Invoke edge function for analysis
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
    
    return (
        <div className="flex flex-col items-center space-y-4">
            <div className="w-full max-w-2xl bg-black rounded-lg overflow-hidden">
                {capturedImage ? (
                    <img src={capturedImage} alt="Captured produce" className="w-full h-auto"/>
                ) : (
                    <video ref={videoRef} autoPlay playsInline className="w-full h-auto" />
                )}
                <canvas ref={canvasRef} className="hidden" />
            </div>
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
                    <Button onClick={handleCapture} disabled={!stream}>
                        <Camera className="mr-2 h-4 w-4" /> Capture
                    </Button>
                )}
            </div>
        </div>
    );
};

export default PhotoCapture;
