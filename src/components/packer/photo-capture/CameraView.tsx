
import { RefObject } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';

interface CameraViewProps {
    videoRef: RefObject<HTMLVideoElement>;
    canvasRef: RefObject<HTMLCanvasElement>;
    isLoading: boolean;
    error: string | null;
}

const CameraView = ({ videoRef, canvasRef, isLoading, error }: CameraViewProps) => {
    return (
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
    );
};

export default CameraView;
