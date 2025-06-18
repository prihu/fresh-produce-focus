
import { useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';
import { useSecurePhotoUpload } from '@/hooks/useSecurePhotoUpload';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Camera, RefreshCw, Check, Loader2, AlertTriangle, Upload } from 'lucide-react';
import { SecurityUtils } from '@/utils/security';

type PackingPhoto = Tables<'packing_photos'>;

interface PhotoCaptureProps {
    orderId: string;
    productId: string;
    onPhotoUploaded: (photo: PackingPhoto) => void;
}

const PhotoCapture = ({ orderId, productId, onPhotoUploaded }: PhotoCaptureProps) => {
    const { toast } = useToast();
    const { uploadPhoto, isUploading } = useSecurePhotoUpload({ orderId, productId, onPhotoUploaded });
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploadMethod, setUploadMethod] = useState<'camera' | 'file'>('camera');

    const startCamera = async () => {
        if (capturedImage || uploadMethod !== 'camera') return;
        
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
                ? 'Camera permission denied. Please allow camera access or use file upload instead.'
                : 'Failed to access camera. Please try file upload instead.';
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

    const cleanupCapturedImage = () => {
        if (capturedImage && capturedImage.startsWith('blob:')) {
            URL.revokeObjectURL(capturedImage);
        }
    };

    useEffect(() => {
        if (uploadMethod === 'camera' && !capturedImage) {
            startCamera();
        } else if (uploadMethod === 'file') {
            stopCamera();
        }
        return () => {
            stopCamera();
            cleanupCapturedImage();
        };
    }, [uploadMethod, capturedImage]);

    const validateImageForAnalysis = (canvas: HTMLCanvasElement): boolean => {
        // Check canvas size
        if (canvas.width === 0 || canvas.height === 0) {
            toast({
                title: "Invalid Image",
                description: "Image appears to be empty or corrupted.",
                variant: "destructive",
            });
            return false;
        }

        // Check if image is too large (OpenAI limit is 20MB, but we'll be conservative)
        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        const sizeInBytes = (imageData.length * 3) / 4; // Approximate base64 to bytes conversion
        const maxSize = 15 * 1024 * 1024; // 15MB limit

        if (sizeInBytes > maxSize) {
            toast({
                title: "Image Too Large",
                description: "Please capture a smaller image or reduce quality.",
                variant: "destructive",
            });
            return false;
        }

        return true;
    };

    const handleCapture = () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (!ctx) return;

        cleanupCapturedImage();

        // Optimize dimensions for OpenAI processing
        const maxWidth = 1920;
        const maxHeight = 1080;
        let { videoWidth: width, videoHeight: height } = video;
        
        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width *= ratio;
            height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(video, 0, 0, width, height);

        // Validate before converting
        if (!validateImageForAnalysis(canvas)) {
            return;
        }

        // Convert to JPEG with high quality for better OpenAI compatibility
        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        console.log('Image captured as JPEG, size:', Math.round((imageData.length * 3) / 4 / 1024), 'KB');
        
        setCapturedImage(imageData);
        stopCamera();
    };

    const convertFileToJpeg = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
            }

            img.onload = () => {
                // Optimize dimensions
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
                ctx.drawImage(img, 0, 0, width, height);

                // Validate before converting
                if (!validateImageForAnalysis(canvas)) {
                    reject(new Error('Image validation failed'));
                    return;
                }

                // Convert to JPEG
                const jpegData = canvas.toDataURL('image/jpeg', 0.9);
                console.log('File converted to JPEG, size:', Math.round((jpegData.length * 3) / 4 / 1024), 'KB');
                resolve(jpegData);
            };

            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = URL.createObjectURL(file);
        });
    };

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file using SecurityUtils
        const validation = SecurityUtils.validateFileUpload(file);
        if (!validation.isValid) {
            toast({
                title: "Invalid File",
                description: validation.error,
                variant: "destructive",
            });
            return;
        }

        // Clean up previous image
        cleanupCapturedImage();

        try {
            // Convert to JPEG format for better OpenAI compatibility
            const jpegData = await convertFileToJpeg(file);
            setCapturedImage(jpegData);
        } catch (error: any) {
            console.error('File conversion error:', error);
            toast({
                title: "File Error",
                description: error.message || "Failed to process the selected file.",
                variant: "destructive",
            });
        }
    };

    const handleRetake = () => {
        cleanupCapturedImage();
        setCapturedImage(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleUpload = async () => {
        if (!capturedImage) return;
        
        try {
            console.log('Starting upload process for JPEG image...');
            await uploadPhoto(capturedImage);
        } catch (error: any) {
            console.error('Upload failed:', error);
            toast({
                title: "Upload Failed",
                description: error.message || "Failed to upload photo",
                variant: "destructive",
            });
        }
    };
    
    return (
        <div className="flex flex-col items-center space-y-4">
            <Tabs value={uploadMethod} onValueChange={(value) => setUploadMethod(value as 'camera' | 'file')} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="camera" className="flex items-center gap-2">
                        <Camera className="h-4 w-4" />
                        Camera
                    </TabsTrigger>
                    <TabsTrigger value="file" className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        File Upload
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="camera" className="mt-4">
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
                </TabsContent>

                <TabsContent value="file" className="mt-4">
                    <div className="w-full max-w-2xl">
                        {capturedImage ? (
                            <div className="bg-black rounded-lg overflow-hidden relative aspect-video flex items-center justify-center">
                                <img src={capturedImage} alt="Selected file" className="w-full h-auto"/>
                            </div>
                        ) : (
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50">
                                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                                <p className="text-lg font-medium text-gray-900 mb-2">Select an image file</p>
                                <p className="text-sm text-gray-500 mb-4">
                                    Supports JPEG, PNG, WebP, GIF up to 15MB
                                </p>
                                <Button 
                                    variant="outline" 
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                >
                                    Choose File
                                </Button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            <div className="flex space-x-4">
                {capturedImage ? (
                    <>
                        <Button onClick={handleRetake} variant="outline" disabled={isUploading}>
                            <RefreshCw className="mr-2 h-4 w-4" /> 
                            {uploadMethod === 'camera' ? 'Retake' : 'Choose Different File'}
                        </Button>
                        <Button onClick={handleUpload} disabled={isUploading}>
                            {isUploading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Uploading...
                                </>
                            ) : (
                                <>
                                    <Check className="mr-2 h-4 w-4" /> 
                                    Confirm & Upload
                                </>
                            )}
                        </Button>
                    </>
                ) : (
                    uploadMethod === 'camera' && (
                        <Button onClick={handleCapture} disabled={!stream || isLoading || !!error}>
                            <Camera className="mr-2 h-4 w-4" /> Capture
                        </Button>
                    )
                )}
            </div>
        </div>
    );
};

export default PhotoCapture;
