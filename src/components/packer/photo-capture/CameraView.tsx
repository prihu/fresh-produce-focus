
import { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Upload, Loader2, AlertTriangle } from 'lucide-react';

interface CameraViewProps {
    videoRef: RefObject<HTMLVideoElement>;
    canvasRef: RefObject<HTMLCanvasElement>;
    stream: MediaStream | null;
    onCapture: () => void;
    onUploadClick: () => void;
    isLoading: boolean;
    error: string | null;
}

const CameraView = ({ videoRef, canvasRef, stream, onCapture, onUploadClick, isLoading, error }: CameraViewProps) => {
    return (
        <>
            <div className="w-full max-w-2xl bg-black rounded-lg overflow-hidden relative aspect-video flex items-center justify-center">
                <video ref={videoRef} autoPlay playsInline muted className={`w-full h-auto ${isLoading || error ? 'hidden' : 'block'}`} />
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
            </div>
            <div className="flex space-x-4">
                <Button onClick={onCapture} disabled={!stream || isLoading || !!error}>
                    <Camera className="mr-2 h-4 w-4" /> Capture
                </Button>
                <Button variant="outline" onClick={onUploadClick}>
                    <Upload className="mr-2 h-4 w-4"/> Upload Photo
                </Button>
            </div>
        </>
    );
};

export default CameraView;
