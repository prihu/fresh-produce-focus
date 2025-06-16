
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { Lock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type PackingPhoto = Tables<'packing_photos'>;

interface CapturedImageProps {
    packingPhoto: PackingPhoto;
    onPhotoDeleted?: () => void;
    disabled?: boolean;
}

const CapturedImage = ({ packingPhoto, onPhotoDeleted, disabled }: CapturedImageProps) => {
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

    const handleDelete = async () => {
        if (!onPhotoDeleted || disabled) return;
        
        try {
            // Delete from storage
            await supabase.storage
                .from('packing-photos')
                .remove([packingPhoto.storage_path]);
            
            // Delete from database
            await supabase
                .from('packing_photos')
                .delete()
                .eq('id', packingPhoto.id);
            
            onPhotoDeleted();
        } catch (error) {
            console.error('Error deleting photo:', error);
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Captured Image</h3>
                {onPhotoDeleted && !disabled && (
                    <Button
                        onClick={handleDelete}
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                    </Button>
                )}
            </div>
            <div className="p-4 border rounded-lg bg-muted/50 aspect-video flex items-center justify-center">
                {isUrlLoading ? (
                    <p>Loading image...</p>
                ) : imageUrl ? (
                    <img src={imageUrl} alt="Packed product" className="max-w-full max-h-full rounded-md" />
                ) : (
                    <div className="text-muted-foreground flex flex-col items-center gap-2">
                        <Lock className="h-5 w-5"/>
                        <span>Image is private.</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CapturedImage;
