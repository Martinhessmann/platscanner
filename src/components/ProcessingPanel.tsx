import React from 'react';
import { Scan, Sparkles, Zap, XCircle, Clock, Camera, Package, AlertCircle, CheckCircle, Archive, ShieldAlert, Database } from 'lucide-react';
import { ImageState } from '../types';

interface ProcessingPanelProps {
  stage: 'analyzing' | 'analyzed' | 'fetching' | 'complete';
  progress?: {
    current: number;
    total: number;
  };
  onStop?: () => void;
  canStop?: boolean;
  images: Map<string, ImageState>;
  activeImageId: string | null;
  duplicatesPerImage?: Map<string, number>;
  currentFetchItem?: { name: string; index: number; total: number };
  onImageRemove?: (id: string) => void;
  onImageSelect?: (id: string) => void;
  onImageRetry?: (id: string) => void;
}

const ProcessingPanel: React.FC<ProcessingPanelProps> = ({
  stage,
  progress,
  onStop,
  canStop = false,
  images,
  activeImageId,
  duplicatesPerImage = new Map(),
  currentFetchItem,
  onImageRemove,
  onImageSelect,
  onImageRetry
}) => {
  const imageArray = Array.from(images.entries());
  const activeImage = activeImageId ? images.get(activeImageId) : null;

  const getStatusIcon = (status: ImageState['status']) => {
    switch (status) {
      case 'queued':
        return <Clock size={16} className="text-gray-400" />;
      case 'analyzing':
        return <Camera size={16} className="text-tenno-blue animate-pulse" />;
      case 'analyzed':
        return <Package size={16} className="text-yellow-400" />;
      case 'fetching':
        return <Zap size={16} className="text-orokin-gold animate-pulse" />;
      case 'complete':
        return <CheckCircle size={16} className="text-corpus-green" />;
      case 'error':
        return <AlertCircle size={16} className="text-grineer-red" />;
    }
  };

  const getStatusText = (imageId: string, image: ImageState) => {
    const duplicates = duplicatesPerImage.get(imageId) || 0;
    const newItems = image.results.length;
    const totalDetected = newItems + duplicates;

    // Helper function to get category breakdown
    const getCategoryBreakdown = (items: DetectedItem[]) => {
      const categories = items.reduce((acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return Object.entries(categories)
        .map(([category, count]) => {
          const categoryName = category === 'prime_parts' ? 'Prime Parts' :
                              category === 'relics' ? 'Relics' :
                              category === 'syndicate_rewards' ? 'Syndicate' :
                              category === 'mods' ? 'Mods' : category;
          return `${count} ${categoryName}`;
        })
        .join(', ');
    };

    switch (image.status) {
      case 'queued':
        return 'Waiting in queue...';
      case 'analyzing':
        return image.wasCached ? 'Using cached analysis...' : 'Extracting text with OCR...';
      case 'analyzed':
        if (totalDetected === 0) {
          return image.wasCached ? 'No items detected (cached result)' : 'No items detected';
        } else if (duplicates > 0) {
          return `Found ${totalDetected} items (${newItems} new, ${duplicates} duplicates)${image.wasCached ? ' - cached' : ''}`;
        } else {
          return `Found ${newItems} new items${image.wasCached ? ' (cached result)' : ''}`;
        }
      case 'fetching':
        if (currentFetchItem && imageId === activeImageId) {
          return (
            <span>
              Fetching prices: <span className="text-orokin-gold">{currentFetchItem.name}</span> ({currentFetchItem.index}/{currentFetchItem.total})
            </span>
          );
        }
        return `Fetching prices for ${newItems} items...`;
      case 'complete':
        if (totalDetected === 0) {
          return 'No items found';
        } else if (duplicates > 0) {
          const categoryBreakdown = getCategoryBreakdown(image.results);
          return `Added ${newItems} items (${duplicates} duplicates skipped) - ${categoryBreakdown}`;
        } else {
          const categoryBreakdown = getCategoryBreakdown(image.results);
          return `Added ${newItems} items to inventory - ${categoryBreakdown}`;
        }
      case 'error':
        return image.error || 'Processing failed';
    }
  };

  const getFileName = (file: File) => {
    const name = file.name;
    if (name.length > 25) {
      return name.substring(0, 22) + '...';
    }
    return name;
  };

  // Calculate overall progress
  const completedImages = imageArray.filter(([_, img]) => img.status === 'complete' || img.status === 'error').length;
  const totalImages = imageArray.length;
  const overallProgress = totalImages > 0 ? Math.round((completedImages / totalImages) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Main Processing Status */}
      <div className="text-center">
        <div className="relative w-20 h-20 mx-auto mb-4">
          {/* Progress ring */}
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              className="text-gray-700"
            />
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeDasharray={`${2 * Math.PI * 36}`}
              strokeDashoffset={`${2 * Math.PI * 36 * (1 - overallProgress / 100)}`}
              className="text-tenno-blue transition-all duration-500"
            />
          </svg>

          {/* Icon in center */}
          <div className="absolute inset-0 flex items-center justify-center">
            {stage === 'analyzing' && (
              <Scan size={32} className="text-tenno-blue animate-pulse" />
            )}
            {stage === 'analyzed' && (
              <Clock size={32} className="text-corpus-green animate-pulse" />
            )}
            {stage === 'fetching' && (
              <Zap size={32} className="text-orokin-gold animate-pulse" />
            )}
            {stage === 'complete' && (
              <Sparkles size={32} className="text-corpus-green animate-float" />
            )}
          </div>
        </div>

        {/* Status text */}
        <h3 className="text-lg font-semibold text-white mb-1">
          {stage === 'analyzing' && "Analyzing Screenshots"}
          {stage === 'analyzed' && "Analysis Complete"}
          {stage === 'fetching' && `Fetching Market Prices`}
          {stage === 'complete' && "Processing Complete"}
        </h3>

        <p className="text-sm text-gray-400">
          {totalImages > 1 ? `Processing ${totalImages} images` : `Processing ${totalImages} image`}
          {progress && stage === 'fetching' && ` • Item ${progress.current} of ${progress.total}`}
        </p>
      </div>

      {/* Image Processing Details */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-2">
          <Archive size={14} />
          Image Details
        </h4>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {imageArray.map(([id, image]) => {
            const isActive = id === activeImageId;
            const duplicates = duplicatesPerImage.get(id) || 0;

            return (
              <div
                key={id}
                onClick={() => onImageSelect?.(id)}
                className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors cursor-pointer ${
                  isActive ? 'bg-gray-800/70 border border-tenno-blue/40' : 'bg-gray-900/40 hover:bg-gray-800/50'
                }`}
              >
                {/* Status Icon */}
                <div className="flex-shrink-0">
                  {image.wasCached && image.status === 'analyzing' ? (
                    <Database size={16} className="text-corpus-green animate-pulse" />
                  ) : (
                    getStatusIcon(image.status)
                  )}
                </div>

                {/* Image Preview */}
                <div className="w-8 h-8 rounded overflow-hidden bg-gray-800 flex-shrink-0">
                  <img
                    src={image.preview}
                    alt={image.file.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 truncate">
                      {getFileName(image.file)}
                    </span>
                    {duplicates > 0 && image.status !== 'queued' && image.status !== 'analyzing' && (
                      <span className="text-xs text-yellow-400 flex items-center gap-1">
                        <ShieldAlert size={10} />
                        {duplicates} dup
                      </span>
                    )}
                    {image.wasCached && (image.status === 'analyzed' || image.status === 'complete') && (
                      <span className="text-xs text-corpus-green flex items-center gap-1">
                        <Database size={10} />
                        cached
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-200 mt-0.5">
                    {getStatusText(id, image)}
                  </div>
                </div>

                {/* Right-side actions: count (success) or retry (error) and remove */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {image.status !== 'queued' && image.status !== 'analyzing' && image.results.length > 0 && (
                    <span className="px-1.5 py-0.5 bg-gray-700/50 rounded text-xs text-gray-300">
                      {image.results.length}
                    </span>
                  )}
                  {image.status === 'error' && onImageRetry && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onImageRetry(id);
                      }}
                      className="px-2 py-0.5 bg-tenno-blue/20 hover:bg-tenno-blue/35 border border-tenno-blue/40 text-tenno-light rounded text-xs transition-colors"
                      title="Retry analysis"
                    >
                      Retry
                    </button>
                  )}
                  {onImageRemove && stage === 'complete' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onImageRemove(id);
                      }}
                      className="p-1 rounded-full bg-grineer-red/20 hover:bg-grineer-red/40 text-grineer-red transition-colors"
                      title="Remove image"
                    >
                      <XCircle size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stop button */}
      {canStop && onStop && (
        <div className="text-center">
          <button
            onClick={onStop}
            className="inline-flex items-center gap-2 px-4 py-2 bg-grineer-red/20 hover:bg-grineer-red/30 border border-grineer-red/50 text-grineer-red rounded-lg transition-colors text-sm"
            title="Stop processing"
          >
            <XCircle size={16} />
            <span>Stop Processing</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ProcessingPanel;