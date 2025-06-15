
import { useState, useCallback, useRef, RefObject, useEffect } from 'react';
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
            
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
                setStream(mediaStream);
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

    useEffect(() => {
        const videoEl = videoRef.current;
        if (!stream || !videoEl) {
            if (!error) setIsLoading(true);
            return;
        }

        let stillLoading = true;
        const loadingTimeout = setTimeout(() => {
            if (stillLoading) {
                console.error("Camera loading timed out.");
                setError("Camera timed out. Please try again or check permissions.");
                setIsLoading(false);
                stopCamera();
            }
        }, 10000);

        const handleLoadedData = () => {
            videoEl.play().catch(e => {
                console.error("Video play failed", e);
                setError("Could not start video playback.");
                setIsLoading(false);
            });
        };
        
        const handlePlaying = () => {
            stillLoading = false;
            setIsLoading(false);
            clearTimeout(loadingTimeout);
        }
        
        const handleError = () => {
            setError("A video error occurred.");
            setIsLoading(false);
            clearTimeout(loadingTimeout);
        }

        videoEl.addEventListener('loadeddata', handleLoadedData);
        videoEl.addEventListener('playing', handlePlaying);
        videoEl.addEventListener('error', handleError);
        
        if (videoEl.readyState >= 3) {
            handleLoadedData();
        }

        return () => {
            clearTimeout(loadingTimeout);
            videoEl.removeEventListener('loadeddata', handleLoadedData);
            videoEl.removeEventListener('playing', handlePlaying);
            videoEl.removeEventListener('error', handleError);
        };
    }, [stream, videoRef, error, stopCamera]);

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
