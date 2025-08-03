
import { useState, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';
import { useSecurePhotoUpload } from '@/hooks/useSecurePhotoUpload';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Camera, RefreshCw, Check, Loader2, Upload } from 'lucide-react';
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
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [uploadMethod, setUploadMethod] = useState<'camera' | 'file'>('camera');

    const cleanupCapturedImage = () => {
        if (capturedImage && capturedImage.startsWith('blob:')) {
            URL.revokeObjectURL(capturedImage);
        }
    };

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

    const handleCameraCapture = () => {
        cameraInputRef.current?.click();
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
        if (cameraInputRef.current) {
            cameraInputRef.current.value = '';
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
                    <div className="w-full max-w-2xl">
                        {capturedImage ? (
                            <div className="bg-black rounded-lg overflow-hidden relative aspect-video flex items-center justify-center">
                                <img src={capturedImage} alt="Captured produce" className="w-full h-auto"/>
                            </div>
                        ) : (
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50">
                                <Camera className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                                <p className="text-lg font-medium text-gray-900 mb-2">Use Device Camera</p>
                                <p className="text-sm text-gray-500 mb-4">
                                    Tap to open your device's camera and capture a photo
                                </p>
                                <Button 
                                    variant="outline" 
                                    onClick={handleCameraCapture}
                                    disabled={isUploading}
                                    className="min-h-[48px] min-w-[120px]"
                                >
                                    <Camera className="mr-2 h-4 w-4" />
                                    Open Camera
                                </Button>
                                <input
                                    ref={cameraInputRef}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                            </div>
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
                                    className="min-h-[48px] min-w-[120px]"
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
                        <Button 
                            onClick={handleCameraCapture} 
                            disabled={isUploading}
                            className="min-h-[48px]"
                        >
                            <Camera className="mr-2 h-4 w-4" /> 
                            Open Camera
                        </Button>
                    )
                )}
            </div>
        </div>
    );
};

export default PhotoCapture;
