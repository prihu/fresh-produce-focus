
import { useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Camera, RefreshCw, Check, Loader2, AlertTriangle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

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
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const startCamera = async () => {
        if (capturedImage) return; // Don't start camera if we have a captured image
        
        setIsLoading(true);
        setError(null);
        
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'environment'
                }
            });
            
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err: any) {
            const errorMessage = err.name === 'NotAllowedError' 
                ? 'Camera permission denied. Please allow camera access and refresh the page.'
                : 'Failed to access camera. Please check your camera permissions.';
            setError(errorMessage);
            console.error('Camera error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    };

    useEffect(() => {
        if (!capturedImage) {
            startCamera();
        }
        return () => {
            stopCamera();
        };
    }, [capturedImage]);

    const handleCapture = () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (!ctx) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        const imageData = canvas.toDataURL('image/webp', 0.8);
        setCapturedImage(imageData);
        stopCamera();
    };

    const handleRetake = () => {
        setCapturedImage(null);
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
            <div className="w-full max-w-2xl bg-black rounded-lg overflow-hidden relative aspect-video flex items-center justify-center">
                {capturedImage ? (
                    <img src={capturedImage} alt="Captured produce" className="w-full h-auto"/>
                ) : (
                    <>
                        <video 
                            ref={videoRef} 
                            autoPlay 
                            playsInline 
                            muted 
                            className={`w-full h-auto ${isLoading || error ? 'hidden' : 'block'}`} 
                        />
                        <canvas ref={canvasRef} className="hidden" />

                        {isLoading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-white space-y-2">
                                <Loader2 className="h-8 w-8 animate-spin" />
                                <p>Starting camera...</p>
                            </div>
                        )}

                        {error && !isLoading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4 text-center space-y-2">
                                <AlertTriangle className="h-8 w-8 text-destructive" />
                                <p className="text-destructive font-semibold">Camera Error</p>
                                <p className="text-sm text-muted-foreground">{error}</p>
                            </div>
                        )}
                    </>
                )}
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
                    <Button onClick={handleCapture} disabled={!stream || isLoading || !!error}>
                        <Camera className="mr-2 h-4 w-4" /> Capture
                    </Button>
                )}
            </div>
        </div>
    );
};

export default PhotoCapture;
