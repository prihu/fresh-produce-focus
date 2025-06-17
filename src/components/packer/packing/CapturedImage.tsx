
import { Tables } from '@/integrations/supabase/types';
import { Lock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import EnhancedImage from '@/components/ui/enhanced-image';

type PackingPhoto = Tables<'packing_photos'>;

interface CapturedImageProps {
    packingPhoto: PackingPhoto;
    onPhotoDeleted?: () => void;
    disabled?: boolean;
}

const CapturedImage = ({ packingPhoto, onPhotoDeleted, disabled }: CapturedImageProps) => {
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
                <EnhancedImage
                    storagePath={packingPhoto.storage_path}
                    alt="Packed product"
                    className="max-w-full max-h-full rounded-md object-contain"
                    fallbackClassName="w-full h-full"
                    bucket="packing-photos"
                />
            </div>
        </div>
    );
};

export default CapturedImage;
