
import { Button } from '@/components/ui/button';
import { Check, RefreshCw } from 'lucide-react';

interface ImagePreviewProps {
    image: string;
    isUploading: boolean;
    onRetake: () => void;
    onUpload: () => void;
}

const ImagePreview = ({ image, isUploading, onRetake, onUpload }: ImagePreviewProps) => {
    return (
        <>
            <div className="w-full max-w-2xl bg-black rounded-lg overflow-hidden">
                <img src={image} alt="Captured produce" className="w-full h-auto"/>
            </div>
            <div className="flex space-x-4">
                <Button onClick={onRetake} variant="outline" disabled={isUploading}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Retake
                </Button>
                <Button onClick={onUpload} disabled={isUploading}>
                    {isUploading ? "Uploading..." : <><Check className="mr-2 h-4 w-4" /> Confirm & Upload</>}
                </Button>
            </div>
        </>
    );
};

export default ImagePreview;
