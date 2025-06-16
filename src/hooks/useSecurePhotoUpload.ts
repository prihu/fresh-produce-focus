
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { Tables } from '@/integrations/supabase/types';
import { useSecureAuth } from '@/contexts/SecureAuthContext';
import { SecurityUtils } from '@/utils/security';

type PackingPhoto = Tables<'packing_photos'>;

interface UseSecurePhotoUploadProps {
  orderId: string;
  productId: string;
  onPhotoUploaded: (photo: PackingPhoto) => void;
}

export const useSecurePhotoUpload = ({ orderId, productId, onPhotoUploaded }: UseSecurePhotoUploadProps) => {
  const { toast } = useToast();
  const { user, canAccessOrder } = useSecureAuth();
  const [isUploading, setIsUploading] = useState(false);

  const uploadPhoto = async (image: string) => {
    if (!image || !user) {
      toast({
        title: "Upload Failed",
        description: "Authentication required for photo upload",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Convert base64 to blob for file validation
      const response = await fetch(image);
      const blob = await response.blob();
      
      // Create a File object for validation
      const file = new File([blob], 'photo.webp', { type: 'image/webp' });
      
      // Validate file
      const validation = SecurityUtils.validateFileUpload(file);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      // Verify order access before upload
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('packer_id, status')
        .eq('id', orderId)
        .single();

      if (orderError) {
        throw new Error('Failed to verify order access');
      }

      if (!canAccessOrder(orderData.packer_id)) {
        throw new Error('You do not have permission to upload photos for this order');
      }

      if (orderData.status === 'packed') {
        throw new Error('Cannot upload photos for already packed orders');
      }

      // Generate secure filename with order validation
      const fileName = `${orderId}/${uuidv4()}.webp`;

      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('packing-photos')
        .upload(fileName, blob, {
          contentType: 'image/webp',
          upsert: false
        });
      
      if (uploadError) {
        throw new Error(`Upload failed: ${SecurityUtils.formatSafeErrorMessage(uploadError)}`);
      }

      // Insert photo record with validation
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
        // Clean up uploaded file if database insert fails
        await supabase.storage
          .from('packing-photos')
          .remove([uploadData.path]);
        
        throw new Error(`Failed to save photo record: ${SecurityUtils.formatSafeErrorMessage(insertError)}`);
      }
      
      toast({ 
        title: "Success", 
        description: "Photo uploaded and analysis started." 
      });

      // Trigger AI analysis
      try {
        await supabase.functions.invoke('analyze-image', {
          body: { packing_photo_id: photoRecord.id },
        });
      } catch (analysisError) {
        console.warn('AI analysis failed to start:', SecurityUtils.formatSafeErrorMessage(analysisError));
        // Don't fail the upload if analysis fails to start
      }
      
      onPhotoUploaded(photoRecord);

    } catch (error: any) {
      const safeMessage = SecurityUtils.formatSafeErrorMessage(error);
      toast({
        title: "Upload Failed",
        description: safeMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadPhoto, isUploading };
};
