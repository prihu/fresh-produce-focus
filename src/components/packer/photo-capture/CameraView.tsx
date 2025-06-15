
import { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Upload } from 'lucide-react';

interface CameraViewProps {
    videoRef: RefObject<HTMLVideoElement>;
    canvasRef: RefObject<HTMLCanvasElement>;
    stream: MediaStream | null;
    onCapture: () => void;
    onUploadClick: () => void;
}

const CameraView = ({ videoRef, canvasRef, stream, onCapture, onUploadClick }: CameraViewProps) => {
    return (
        <>
            <div className="w-full max-w-2xl bg-black rounded-lg overflow-hidden">
                <video ref={videoRef} autoPlay playsInline className="w-full h-auto" />
                <canvas ref={canvasRef} className="hidden" />
            </div>
            <div className="flex space-x-4">
                <Button onClick={onCapture} disabled={!stream}>
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
