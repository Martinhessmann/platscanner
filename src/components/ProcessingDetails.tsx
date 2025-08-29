import React, { useState } from 'react';
import { ImageState, DetectedItem } from '../types';
import { Camera, Package, AlertCircle, CheckCircle, Clock, Zap, Archive, ShieldAlert, Database } from 'lucide-react';
import ImageModal from './ImageModal';

interface ProcessingDetailsProps {
  images: Map<string, ImageState>;
  activeImageId: string | null;
  duplicatesPerImage?: Map<string, number>;
  currentFetchItem?: { name: string; index: number; total: number };
}

const ProcessingDetails: React.FC<ProcessingDetailsProps> = ({
  images,
  activeImageId,
  duplicatesPerImage = new Map(),
  currentFetchItem
}) => {
  const imageArray = Array.from(images.entries());
  
  // Modal state
  const [modalImage, setModalImage] = useState<{
    src: string;
    fileName: string;
    items: DetectedItem[];
    screenType?: string;
  } | null>(null);

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
        return image.wasCached ? 'Using cached analysis...' : 'Sending to Gemini AI...';
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

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-3">
        <Archive size={16} />
        Processing Details
      </h4>
      
      {imageArray.map(([id, image]) => {
        const isActive = id === activeImageId;
        const duplicates = duplicatesPerImage.get(id) || 0;
        
        return (
          <div
            key={id}
            className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
              isActive ? 'bg-gray-800/50 border border-tenno-blue/30' : 'bg-gray-900/30'
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
            <div 
              className="w-10 h-10 rounded overflow-hidden bg-gray-800 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => {
                if (image.status !== 'queued' && image.status !== 'analyzing') {
                  setModalImage({
                    src: image.preview,
                    fileName: image.file.name,
                    items: image.results,
                    screenType: image.screenType
                  });
                }
              }}
              title={image.status !== 'queued' && image.status !== 'analyzing' ? 'Click to view details' : ''}
            >
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
                    <ShieldAlert size={12} />
                    {duplicates} duplicate{duplicates > 1 ? 's' : ''}
                  </span>
                )}
                {image.wasCached && (image.status === 'analyzed' || image.status === 'complete') && (
                  <span className="text-xs text-corpus-green flex items-center gap-1">
                    <Database size={10} />
                    cached
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-200 mt-0.5">
                {getStatusText(id, image)}
              </div>
            </div>

            {/* Item count badge */}
            {image.status !== 'queued' && image.status !== 'analyzing' && image.results.length > 0 && (
              <div className="flex-shrink-0">
                <span className="px-2 py-1 bg-gray-700/50 rounded text-xs text-gray-300">
                  {image.results.length} new
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>

    {/* Image Modal */}
    {modalImage && (
      <ImageModal
        isOpen={!!modalImage}
        onClose={() => setModalImage(null)}
        imageSrc={modalImage.src}
        fileName={modalImage.fileName}
        detectedItems={modalImage.items}
        screenType={modalImage.screenType}
      />
    )}
  </div>
  );
};

export default ProcessingDetails;