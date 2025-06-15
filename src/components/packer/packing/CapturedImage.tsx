
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { Lock } from 'lucide-react';

type PackingPhoto = Tables<'packing_photos'>;

interface CapturedImageProps {
    packingPhoto: PackingPhoto;
}

const CapturedImage = ({ packingPhoto }: CapturedImageProps) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isUrlLoading, setIsUrlLoading] = useState(false);

    useEffect(() => {
        if (packingPhoto?.storage_path) {
            const getSignedUrl = async () => {
                setIsUrlLoading(true);
                const { data, error } = await supabase.storage
                    .from('packing-photos')
                    .createSignedUrl(packingPhoto.storage_path, 300); // 5 minutes validity
                if (error) {
                    console.error("Error creating signed URL:", error);
                    setImageUrl(null);
                } else {
                    setImageUrl(data.signedUrl);
                }
                setIsUrlLoading(false);
            };
            getSignedUrl();
        }
    }, [packingPhoto]);

    return (
        <div>
            <h3 className="font-semibold mb-2">Captured Image</h3>
            <div className="p-4 border rounded-lg bg-muted/50 aspect-video flex items-center justify-center">
                {isUrlLoading ? <p>Loading image...</p> : imageUrl ? <img src={imageUrl} alt="Packed product" className="max-w-full max-h-full rounded-md" /> : <div className="text-muted-foreground flex flex-col items-center gap-2"><Lock className="h-5 w-5"/><span>Image is private.</span></div>}
            </div>
        </div>
    );
};

export default CapturedImage;
