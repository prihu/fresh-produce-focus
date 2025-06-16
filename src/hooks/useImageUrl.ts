
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseImageUrlProps {
  storagePath: string | null;
  bucket?: string;
}

interface UseImageUrlReturn {
  imageUrl: string | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
}

export const useImageUrl = ({ 
  storagePath, 
  bucket = 'packing-photos' 
}: UseImageUrlProps): UseImageUrlReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Since bucket is now public, we can use getPublicUrl directly
  const imageUrl = useMemo(() => {
    if (!storagePath) {
      console.log('useImageUrl: No storage path provided');
      return null;
    }

    try {
      const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(storagePath);
      
      const url = data.publicUrl;
      console.log('useImageUrl: Generated public URL for', storagePath, ':', url);
      return url;
    } catch (error) {
      console.error('useImageUrl: Error generating public URL for', storagePath, ':', error);
      setError('Failed to generate image URL');
      return null;
    }
  }, [storagePath, bucket, retryCount]);

  // Test URL accessibility when it changes
  useEffect(() => {
    if (!imageUrl) return;

    setIsLoading(true);
    setError(null);

    const testImageAccess = async () => {
      try {
        const response = await fetch(imageUrl, { 
          method: 'HEAD',
          mode: 'cors'
        });
        
        console.log('useImageUrl: Accessibility test for', imageUrl, '- Status:', response.status);
        
        if (!response.ok) {
          throw new Error(`Image not accessible: HTTP ${response.status}`);
        }
        
        setError(null);
      } catch (error) {
        console.error('useImageUrl: Image accessibility test failed:', error);
        setError(`Image not accessible: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
    };

    testImageAccess();
  }, [imageUrl]);

  const retry = () => {
    setRetryCount(prev => prev + 1);
    setError(null);
  };

  return { imageUrl, isLoading, error, retry };
};
