
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
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!storagePath) {
      console.log('useImageUrl: No storage path provided');
      setImageUrl(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const fetchSignedUrl = async () => {
      setIsLoading(true);
      setError(null);

      try {
        console.log('useImageUrl: Fetching signed URL for', storagePath);
        
        // Create signed URL with 1 hour expiry
        const { data, error: signedUrlError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(storagePath, 3600); // 1 hour validity

        if (signedUrlError) {
          throw new Error(`Failed to create signed URL: ${signedUrlError.message}`);
        }

        if (!data?.signedUrl) {
          throw new Error('No signed URL returned');
        }

        console.log('useImageUrl: Successfully created signed URL for', storagePath);
        setImageUrl(data.signedUrl);
        setError(null);

        // Test URL accessibility
        const response = await fetch(data.signedUrl, { 
          method: 'HEAD',
          mode: 'cors'
        });
        
        if (!response.ok) {
          throw new Error(`Image not accessible: HTTP ${response.status}`);
        }

      } catch (error: any) {
        console.error('useImageUrl: Error fetching signed URL for', storagePath, ':', error);
        setError(`Failed to load image: ${error.message}`);
        setImageUrl(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSignedUrl();
  }, [storagePath, bucket, retryCount]);

  const retry = () => {
    console.log('useImageUrl: Retrying URL fetch for', storagePath);
    setRetryCount(prev => prev + 1);
    setError(null);
  };

  return { imageUrl, isLoading, error, retry };
};
