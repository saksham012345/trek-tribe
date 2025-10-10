import React, { useState, useRef, useEffect } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
  placeholder?: string;
  sizes?: string;
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className = '',
  width,
  height,
  loading = 'lazy',
  placeholder,
  sizes
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current && loading === 'lazy') {
      observer.observe(imgRef.current);
    } else if (loading === 'eager') {
      setIsInView(true);
    }

    return () => observer.disconnect();
  }, [loading]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
  };

  // Generate WebP and fallback URLs if not already provided
  const getOptimizedSrc = (originalSrc: string) => {
    if (originalSrc.includes('webp') || originalSrc.startsWith('data:') || originalSrc.startsWith('blob:')) {
      return originalSrc;
    }
    
    // For external URLs or if WebP conversion is not available, return original
    if (originalSrc.startsWith('http')) {
      return originalSrc;
    }
    
    // For internal assets, try to use WebP version
    const webpSrc = originalSrc.replace(/\.(jpe?g|png)$/i, '.webp');
    return webpSrc;
  };

  const webpSrc = getOptimizedSrc(src);
  const shouldShowPlaceholder = !isLoaded && !hasError && placeholder;

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ width, height }}>
      {/* Placeholder */}
      {shouldShowPlaceholder && (
        <div className="absolute inset-0 bg-gradient-to-br from-forest-100 to-nature-100 flex items-center justify-center">
          <div className="animate-pulse">
            <div className="w-12 h-12 bg-forest-200 rounded-full flex items-center justify-center">
              <span className="text-2xl">🏔️</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Image */}
      {(isInView || loading === 'eager') && (
        <picture>
          {/* WebP version for supported browsers */}
          <source srcSet={webpSrc} type="image/webp" sizes={sizes} />
          
          {/* Fallback to original format */}
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            width={width}
            height={height}
            onLoad={handleLoad}
            onError={handleError}
            className={`
              transition-opacity duration-300
              ${isLoaded ? 'opacity-100' : 'opacity-0'}
              ${hasError ? 'hidden' : ''}
              w-full h-full object-cover
            `}
            loading={loading}
            sizes={sizes}
            decoding="async"
          />
        </picture>
      )}

      {/* Error fallback */}
      {hasError && (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <span className="text-4xl block mb-2">🖼️</span>
            <span className="text-sm">Image unavailable</span>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {!isLoaded && !hasError && isInView && !placeholder && (
        <div className="absolute inset-0 bg-forest-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nature-600"></div>
        </div>
      )}
    </div>
  );
};

export default OptimizedImage;