
import { useState, useCallback, useRef, RefObject } from 'react';
import { useToast } from '@/hooks/use-toast';

export const useCamera = (videoRef: RefObject<HTMLVideoElement>) => {
    const { toast } = useToast();
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const stopCamera = useCallback(() => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    }, [stream]);

    const startCamera = useCallback(async () => {
        stopCamera();
        setIsLoading(true);
        setError(null);
        
        const constraints = {
            video: { 
                facingMode: { ideal: 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };

        try {
            let mediaStream;
            try {
                mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (err) {
                console.warn("Failed to get environment camera, trying user camera", err);
                const fallbackConstraints = { video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } };
                mediaStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
                toast({
                    title: "Camera switched",
                    description: "Rear camera not found or failed to start. Switched to front camera.",
                });
            }
            
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
                videoRef.current.onloadedmetadata = () => {
                    setIsLoading(false);
                };
                videoRef.current.onerror = () => {
                    setError("Video stream error.");
                    setIsLoading(false);
                }
            } else {
                console.warn("videoRef.current is null when trying to set stream.");
                setError("Video element not available.");
                setIsLoading(false);
            }
        } catch (err: any) {
            console.error("Error accessing camera:", err);
            let errorMessage = "Could not access camera. Please check permissions.";
            if (err.name === 'NotAllowedError') {
                errorMessage = "Camera access was denied. Please grant permission in your browser settings.";
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                errorMessage = "No camera found on this device.";
            } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                errorMessage = "Camera is already in use by another application.";
            }

            setError(errorMessage);
            toast({
                title: "Camera Error",
                description: errorMessage,
                variant: "destructive",
            });
            setIsLoading(false);
        }
    }, [toast, videoRef, stopCamera]);

    const captureImage = useCallback((): string | null => {
        if (videoRef.current && canvasRef.current && videoRef.current.readyState >= 3) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if(context) {
              context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
              stopCamera();
              return canvas.toDataURL('image/webp', 0.8);
            }
        }
        return null;
    }, [videoRef, stopCamera]);

    return { stream, startCamera, stopCamera, captureImage, canvasRef, isLoading, error };
};
