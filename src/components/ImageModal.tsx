import React, { useState } from 'react';
import { X, Eye, Package, Star, Shield, Zap, Bug } from 'lucide-react';
import { DetectedItem } from '../types';
import DebugInfo from './DebugInfo';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  fileName: string;
  detectedItems: DetectedItem[];
  screenType?: string;
}

const ImageModal: React.FC<ImageModalProps> = ({
  isOpen,
  onClose,
  imageSrc,
  fileName,
  detectedItems,
  screenType
}) => {
  if (!isOpen) return null;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'prime_parts': return <Package size={16} className="text-orange-400" />;
      case 'relics': return <Star size={16} className="text-yellow-400" />;
      case 'syndicate_rewards': return <Shield size={16} className="text-blue-400" />;
      case 'mods': return <Zap size={16} className="text-purple-400" />;
      default: return <Package size={16} className="text-gray-400" />;
    }
  };

  const getCategoryName = (category: string) => {
    switch (category) {
      case 'prime_parts': return 'Prime Parts';
      case 'relics': return 'Relics';
      case 'syndicate_rewards': return 'Syndicate';
      case 'mods': return 'Mods';
      default: return category;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'prime_parts': return 'text-orange-400';
      case 'relics': return 'text-yellow-400';
      case 'syndicate_rewards': return 'text-blue-400';
      case 'mods': return 'text-purple-400';
      default: return 'text-gray-400';
    }
  };

  const [showDebug, setShowDebug] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-gray-900 rounded-xl border border-gray-700 max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Eye size={20} className="text-tenno-blue" />
            <div>
              <h3 className="text-white font-medium">Image Analysis Results</h3>
              <p className="text-sm text-gray-400">{fileName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              title="Toggle debug information"
            >
              <Bug size={16} className="text-yellow-400" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col lg:flex-row h-full max-h-[calc(90vh-80px)]">
          {/* Image Section */}
          <div className="flex-1 p-4 border-r border-gray-700">
            <div className="text-sm text-gray-400 mb-3">
              <span className="font-medium">Screen Type:</span> {screenType || 'Unknown'}
            </div>
            <div className="relative bg-gray-800 rounded-lg overflow-hidden">
              <img
                src={imageSrc}
                alt={fileName}
                className="w-full h-auto max-h-[60vh] object-contain"
              />
            </div>
          </div>

          {/* Detected Items Section */}
          <div className="w-full lg:w-80 p-4 overflow-y-auto">
            <div className="flex items-center gap-2 mb-4">
              <Package size={16} className="text-tenno-blue" />
              <h4 className="text-white font-medium">Detected Items ({detectedItems.length})</h4>
            </div>

            {detectedItems.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Package size={32} className="mx-auto mb-2 opacity-50" />
                <p>No items detected</p>
              </div>
            ) : (
              <div className="space-y-3">
                {detectedItems.map((item, index) => (
                  <div
                    key={`${item.name}-${index}`}
                    className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50"
                  >
                    <div className="flex items-start gap-2">
                      {getCategoryIcon(item.category)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium truncate">
                            {item.name}
                          </span>
                          {item.quantity && item.quantity > 1 && (
                            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">
                              x{item.quantity}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs ${getCategoryColor(item.category)}`}>
                            {getCategoryName(item.category)}
                          </span>
                          {item.rank !== undefined && item.rank > 0 && (
                            <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                              R{item.rank}
                            </span>
                          )}
                          {item.rarity && (
                            <span className="text-xs bg-gray-600/50 text-gray-300 px-1.5 py-0.5 rounded capitalize">
                              {item.rarity}
                            </span>
                          )}
                        </div>
                        {/* Additional item-specific info */}
                        {item.category === 'syndicate_rewards' && 'standingCost' in item && (
                          <div className="text-xs text-gray-400 mt-1">
                            Standing: {item.standingCost?.toLocaleString()}
                          </div>
                        )}
                        {item.category === 'relics' && 'rarity' in item && (
                          <div className="text-xs text-gray-400 mt-1 capitalize">
                            {item.rarity} Relic
                          </div>
                        )}
                        {item.category === 'mods' && 'type' in item && (
                          <div className="text-xs text-gray-400 mt-1 capitalize">
                            {item.type} Mod
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Debug Information */}
        {showDebug && (
          <div className="border-t border-gray-700">
            <DebugInfo 
              image={{
                id: 'debug',
                file: { name: fileName } as any,
                preview: imageSrc,
                status: 'complete',
                results: detectedItems,
                screenType
              }}
              isVisible={true}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageModal;