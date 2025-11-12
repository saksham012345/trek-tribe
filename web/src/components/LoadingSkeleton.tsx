import React from 'react';

interface LoadingSkeletonProps {
  type?: 'card' | 'list' | 'text' | 'circle' | 'profile' | 'table';
  count?: number;
  className?: string;
}

const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ 
  type = 'card', 
  count = 1,
  className = '' 
}) => {
  const baseClasses = 'animate-pulse bg-gray-200 rounded';

  const renderSkeleton = () => {
    switch (type) {
      case 'card':
        return (
          <div className={`border border-gray-200 rounded-lg overflow-hidden ${className}`}>
            <div className={`h-48 ${baseClasses}`} />
            <div className="p-4 space-y-3">
              <div className={`h-6 ${baseClasses} w-3/4`} />
              <div className={`h-4 ${baseClasses} w-full`} />
              <div className={`h-4 ${baseClasses} w-5/6`} />
              <div className="flex justify-between items-center mt-4">
                <div className={`h-4 ${baseClasses} w-1/4`} />
                <div className={`h-8 ${baseClasses} w-1/3 rounded-full`} />
              </div>
            </div>
          </div>
        );

      case 'list':
        return (
          <div className={`flex items-center space-x-4 p-4 ${className}`}>
            <div className={`h-12 w-12 ${baseClasses} rounded-full flex-shrink-0`} />
            <div className="flex-1 space-y-2">
              <div className={`h-4 ${baseClasses} w-3/4`} />
              <div className={`h-3 ${baseClasses} w-1/2`} />
            </div>
          </div>
        );

      case 'text':
        return (
          <div className={`space-y-2 ${className}`}>
            <div className={`h-4 ${baseClasses} w-full`} />
            <div className={`h-4 ${baseClasses} w-5/6`} />
            <div className={`h-4 ${baseClasses} w-4/6`} />
          </div>
        );

      case 'circle':
        return (
          <div className={`${baseClasses} rounded-full ${className}`} style={{ aspectRatio: '1/1' }} />
        );

      case 'profile':
        return (
          <div className={`${className}`}>
            <div className="flex items-center space-x-4 mb-6">
              <div className={`h-20 w-20 ${baseClasses} rounded-full flex-shrink-0`} />
              <div className="flex-1 space-y-3">
                <div className={`h-6 ${baseClasses} w-1/3`} />
                <div className={`h-4 ${baseClasses} w-1/2`} />
              </div>
            </div>
            <div className="space-y-3">
              <div className={`h-4 ${baseClasses} w-full`} />
              <div className={`h-4 ${baseClasses} w-5/6`} />
              <div className={`h-4 ${baseClasses} w-4/6`} />
            </div>
          </div>
        );

      case 'table':
        return (
          <div className={`${className}`}>
            <div className="grid grid-cols-4 gap-4 p-4 border-b border-gray-200">
              {[...Array(4)].map((_, i) => (
                <div key={i} className={`h-4 ${baseClasses}`} />
              ))}
            </div>
            {[...Array(5)].map((_, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-4 gap-4 p-4 border-b border-gray-100">
                {[...Array(4)].map((_, colIndex) => (
                  <div key={colIndex} className={`h-4 ${baseClasses}`} />
                ))}
              </div>
            ))}
          </div>
        );

      default:
        return <div className={`h-20 ${baseClasses} ${className}`} />;
    }
  };

  return (
    <>
      {[...Array(count)].map((_, index) => (
        <div key={index} className="mb-4">
          {renderSkeleton()}
        </div>
      ))}
    </>
  );
};

export default LoadingSkeleton;
