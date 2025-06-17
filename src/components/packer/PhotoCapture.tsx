
import { useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Camera, RefreshCw, Check, Loader2, AlertTriangle, Upload } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { SecurityUtils } from '@/utils/security';

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
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
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

    const handleCapture = () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (!ctx) return;

        cleanupCapturedImage();

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

        const imageData = canvas.toDataURL('image/webp', 0.8);
        setCapturedImage(imageData);
        stopCamera();
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
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

        // Convert file to data URL for preview
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            setCapturedImage(result);
        };
        reader.onerror = () => {
            toast({
                title: "File Error",
                description: "Failed to read the selected file.",
                variant: "destructive",
            });
        };
        reader.readAsDataURL(file);
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
        
        setIsUploading(true);
        try {
            console.log('Starting photo upload process...');
            
            const blob = await (await fetch(capturedImage)).blob();
            const fileName = `${orderId}/${uuidv4()}.webp`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('packing-photos')
                .upload(fileName, blob);

            if (uploadError) {
                console.error('Storage upload error:', uploadError);
                throw new Error(`Upload failed: ${uploadError.message}`);
            }

            console.log('File uploaded to storage successfully:', uploadData.path);

            const { data: photoRecord, error: insertError } = await supabase
                .from('packing_photos')
                .insert({
                    order_id: orderId,
                    product_id: productId,
                    storage_path: uploadData.path,
                })
                .select()
                .single();

            if (insertError) {
                console.error('Database insert error:', insertError);
                // Clean up uploaded file
                await supabase.storage
                    .from('packing-photos')
                    .remove([uploadData.path]);
                throw new Error(`Database error: ${insertError.message}`);
            }

            console.log('Photo record created successfully:', photoRecord.id);

            toast({ 
                title: "Upload Successful", 
                description: "Photo uploaded. Starting AI analysis..." 
            });

            // Call onPhotoUploaded immediately
            onPhotoUploaded(photoRecord);

            // Start AI analysis with proper error handling
            try {
                console.log('Invoking analyze-image function for photo:', photoRecord.id);
                
                const { data: functionData, error: functionError } = await supabase.functions.invoke('analyze-image', {
                    body: { packing_photo_id: photoRecord.id },
                });

                if (functionError) {
                    console.error('Function invocation error:', functionError);
                    throw new Error(`Analysis failed to start: ${functionError.message}`);
                }

                console.log('Function invocation successful:', functionData);
                
                toast({ 
                    title: "Analysis Started", 
                    description: "AI analysis is processing your image. This will take 30-60 seconds." 
                });

            } catch (analysisError: any) {
                console.error('AI analysis failed to start:', analysisError);
                
                // Update photo status to failed
                await supabase
                    .from('packing_photos')
                    .update({ ai_analysis_status: 'failed' })
                    .eq('id', photoRecord.id);

                toast({
                    title: "Analysis Failed to Start",
                    description: `Could not start AI analysis: ${analysisError.message}. You can retry from the analysis section.`,
                    variant: "destructive",
                });
            }

        } catch (error: any) {
            console.error('Upload process failed:', error);
            toast({
                title: "Upload Failed",
                description: error.message || "Failed to upload photo",
                variant: "destructive",
            });
        } finally {
            setIsUploading(false);
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
