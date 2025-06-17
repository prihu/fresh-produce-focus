
import React, { useState, useCallback } from 'react';
import { ImageIcon, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from './button';
import { useImageUrl } from '@/hooks/useImageUrl';

interface EnhancedImageProps {
  storagePath: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  bucket?: string;
  onError?: (error: string) => void;
  onLoad?: () => void;
}

const EnhancedImage: React.FC<EnhancedImageProps> = ({
  storagePath,
  alt,
  className = '',
  fallbackClassName = '',
  bucket = 'packing-photos',
  onError,
  onLoad
}) => {
  const [imageLoadError, setImageLoadError] = useState(false);
  const { imageUrl, isLoading, error, retry } = useImageUrl({ storagePath, bucket });

  const handleImageLoad = useCallback(() => {
    console.log('EnhancedImage: Image loaded successfully for path:', storagePath);
    setImageLoadError(false);
    onLoad?.();
  }, [storagePath, onLoad]);

  const handleImageError = useCallback(() => {
    console.error('EnhancedImage: Image failed to load for path:', storagePath);
    setImageLoadError(true);
    const errorMessage = `Failed to load image: ${storagePath}`;
    onError?.(errorMessage);
  }, [storagePath, onError]);

  const handleRetry = useCallback(() => {
    setImageLoadError(false);
    retry();
  }, [retry]);

  // Show loading state
  if (isLoading) {
    return (
      <div className={`bg-gray-100 rounded border border-gray-200 flex items-center justify-center ${fallbackClassName}`}>
        <div className="text-center text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto mb-2"></div>
          <p className="text-sm">Loading image...</p>
          <p className="text-xs text-gray-400 mt-1">Using secure access</p>
        </div>
      </div>
    );
  }

  // Show error state with retry option
  if (error || imageLoadError || !imageUrl) {
    return (
      <div className={`bg-gray-100 rounded border border-gray-200 flex flex-col items-center justify-center p-4 ${fallbackClassName}`}>
        <AlertTriangle className="h-8 w-8 text-red-400 mb-2" />
        <p className="text-sm text-gray-700 text-center mb-2 font-medium">
          Image Access Error
        </p>
        <p className="text-xs text-gray-500 text-center mb-3">
          {error || 'Failed to load image with secure access'}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetry}
          className="text-xs px-3 py-1 h-auto"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  // Show the actual image
  return (
    <img
      src={imageUrl}
      alt={alt}
      className={className}
      onLoad={handleImageLoad}
      onError={handleImageError}
      crossOrigin="anonymous"
    />
  );
};

export default EnhancedImage;
