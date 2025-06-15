
import { useState, useCallback, useRef, RefObject } from 'react';
import { useToast } from '@/hooks/use-toast';

export const useCamera = (videoRef: RefObject<HTMLVideoElement>) => {
    const { toast } = useToast();
    const [stream, setStream] = useState<MediaStream | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const stopCamera = useCallback(() => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    }, [stream]);

    const startCamera = useCallback(async () => {
        console.log("useCamera: startCamera called");
        stopCamera(); // Ensure any existing stream is stopped
        try {
            console.log("Requesting user media...");
            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            console.log("Got user media stream:", mediaStream);
            setStream(mediaStream);
            if (videoRef.current) {
                console.log("Setting stream to video element");
                videoRef.current.srcObject = mediaStream;
            } else {
                console.warn("videoRef.current is null when trying to set stream.");
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            toast({
                title: "Camera Error",
                description: "Could not access camera. Please check permissions.",
                variant: "destructive",
            });
        }
    }, [toast, videoRef, stopCamera]);

    const captureImage = useCallback((): string | null => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            context?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
            stopCamera();
            return canvas.toDataURL('image/webp', 0.8);
        }
        return null;
    }, [videoRef, stopCamera]);

    return { stream, startCamera, stopCamera, captureImage, canvasRef };
};
