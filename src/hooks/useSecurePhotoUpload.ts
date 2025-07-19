
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

  // Enhanced rate limiting check
  const checkUploadRateLimit = async (): Promise<boolean> => {
    try {
      const { data: rateLimitCheck, error } = await supabase
        .rpc('check_rate_limit', {
          operation_type: 'photo_upload',
          max_requests: 30, // 30 uploads per hour
          window_minutes: 60
        });

      if (error) {
        console.error('Rate limit check failed:', error);
        return true; // Allow upload if check fails
      }

      return rateLimitCheck === true;
    } catch (error) {
      console.error('Rate limit check error:', error);
      return true; // Allow upload if check fails
    }
  };

  // Reduced retry attempts from 3 to 1 to prevent excessive refresh cycles
  const triggerAnalysisWithRetry = async (photoId: string, maxRetries = 1) => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`Analysis attempt ${attempt + 1} for photo:`, photoId);
        
        // Enhanced session validation
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session?.access_token) {
          throw new Error('Authentication required for analysis');
        }
        
        const { data: functionData, error: functionError } = await supabase.functions.invoke('analyze-image', {
          body: { packing_photo_id: photoId },
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          }
        });

        if (functionError) {
          throw new Error(functionError.message);
        }

        console.log('Function invocation successful:', functionData);
        
        toast({ 
          title: "Analysis Started", 
          description: "AI analysis is processing your image. This will take 30-60 seconds." 
        });
        
        return; // Success, exit retry loop
        
      } catch (analysisError: any) {
        console.error(`Analysis attempt ${attempt + 1} failed:`, analysisError);
        
        // Log failed analysis attempts for monitoring
        console.warn('Photo analysis attempt failed', {
          photoId,
          attempt: attempt + 1,
          error: analysisError.message,
          userId: user?.id,
          timestamp: new Date().toISOString()
        });
        
        if (attempt === maxRetries - 1) {
          // Final attempt failed, update photo status
          await supabase
            .from('packing_photos')
            .update({ ai_analysis_status: 'failed' })
            .eq('id', photoId);

          toast({
            title: "Analysis Failed",
            description: `Could not start AI analysis. The analysis may have failed due to image content or processing issues. Please try uploading a new photo.`,
            variant: "destructive",
          });
        } else {
          // Wait before next retry - reduced delay
          const delay = 1000; // Fixed 1 second delay instead of exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
  };

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
      // Enhanced rate limiting
      const canUpload = await checkUploadRateLimit();
      if (!canUpload) {
        throw new Error('Upload rate limit exceeded. Please wait before uploading more photos.');
      }

      // Convert base64 to blob for file validation
      const response = await fetch(image);
      const blob = await response.blob();
      
      // Create a File object for validation
      const file = new File([blob], 'photo.webp', { type: 'image/webp' });
      
      // Enhanced file validation
      const validation = SecurityUtils.validateFileUpload(file);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      // Additional security checks
      if (blob.size > 15 * 1024 * 1024) { // 15MB limit
        throw new Error('File too large. Maximum size is 15MB.');
      }

      // Verify order access before upload
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('packer_id, status')
        .eq('id', orderId)
        .single();

      if (orderError) {
        console.error('Order verification failed', {
          orderId,
          userId: user.id,
          error: orderError.message,
          timestamp: new Date().toISOString()
        });
        throw new Error('Failed to verify order access');
      }

      if (!canAccessOrder(orderData.packer_id)) {
        console.warn('Unauthorized photo upload attempt', {
          orderId,
          userId: user.id,
          orderPackerId: orderData.packer_id,
          timestamp: new Date().toISOString()
        });
        throw new Error('You do not have permission to upload photos for this order');
      }

      if (orderData.status === 'packed') {
        throw new Error('Cannot upload photos for already packed orders');
      }

      // Update order status to 'in_progress' if it's currently 'pending_packing'
      if (orderData.status === 'pending_packing') {
        const { error: statusError } = await supabase
          .from('orders')
          .update({ status: 'in_progress' })
          .eq('id', orderId);

        if (statusError) {
          console.warn('Failed to update order status to in_progress:', statusError);
          // Continue with upload even if status update fails
        }
      }

      // Generate secure filename with order validation
      const fileName = `${orderId}/${uuidv4()}.webp`;

      // Enhanced upload with metadata
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('packing-photos')
        .upload(fileName, blob, {
          contentType: 'image/webp',
          upsert: false,
          metadata: {
            uploadedBy: user.id,
            orderId: orderId,
            uploadTimestamp: new Date().toISOString()
          }
        });
      
      if (uploadError) {
        console.error('Upload failed', {
          orderId,
          userId: user.id,
          error: uploadError.message,
          timestamp: new Date().toISOString()
        });
        throw new Error(`Upload failed: ${SecurityUtils.formatSafeErrorMessage(uploadError)}`);
      }

      // Insert photo record with enhanced validation
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
        console.error('Database insert failed, cleaning up uploaded file', {
          fileName,
          error: insertError.message,
          timestamp: new Date().toISOString()
        });
        
        await supabase.storage
          .from('packing-photos')
          .remove([uploadData.path]);
        
        throw new Error(`Failed to save photo record: ${SecurityUtils.formatSafeErrorMessage(insertError)}`);
      }
      
      // Log successful upload for monitoring
      console.log('Photo uploaded successfully', {
        photoId: photoRecord.id,
        orderId,
        userId: user.id,
        fileName,
        timestamp: new Date().toISOString()
      });
      
      toast({ 
        title: "Photo uploaded successfully", 
        description: "Starting AI analysis..." 
      });

      // Call onPhotoUploaded immediately after successful upload
      onPhotoUploaded(photoRecord);

      // Trigger AI analysis with reduced retry logic (1 attempt instead of 3)
      await triggerAnalysisWithRetry(photoRecord.id);

    } catch (error: any) {
      const safeMessage = SecurityUtils.formatSafeErrorMessage(error);
      console.error('Photo upload error:', {
        error: error.message,
        userId: user?.id,
        orderId,
        timestamp: new Date().toISOString()
      });
      
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
