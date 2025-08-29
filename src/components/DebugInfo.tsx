import React from 'react';
import { Bug, Eye, AlertTriangle } from 'lucide-react';
import { ImageState } from '../types';

interface DebugInfoProps {
  image: ImageState;
  isVisible: boolean;
}

const DebugInfo: React.FC<DebugInfoProps> = ({ image, isVisible }) => {
  if (!isVisible) return null;

  const getCategoryBreakdown = (items: any[]) => {
    const categories = items.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(categories)
      .map(([category, count]) => `${count} ${category}`)
      .join(', ');
  };

  const getItemDetails = (items: any[]) => {
    return items.map((item, index) => ({
      name: item.name,
      category: item.category,
      quantity: item.quantity || 1,
      rank: item.rank,
      rarity: item.rarity,
      standingCost: item.standingCost,
      syndicate: item.syndicate,
      index
    }));
  };

  return (
    <div className="bg-gray-900/80 backdrop-blur-sm rounded-lg border border-gray-700 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Bug size={16} className="text-yellow-400" />
        <h4 className="text-sm font-medium text-white">Debug Information</h4>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div>
          <h5 className="text-gray-400 mb-2">Image Details</h5>
          <div className="space-y-1">
            <div><span className="text-gray-500">File:</span> <span className="text-white">{image.file.name}</span></div>
            <div><span className="text-gray-500">Status:</span> <span className="text-white">{image.status}</span></div>
            <div><span className="text-gray-500">Screen Type:</span> <span className="text-white">{image.screenType || 'Unknown'}</span></div>
            <div><span className="text-gray-500">Cached:</span> <span className="text-white">{image.wasCached ? 'Yes' : 'No'}</span></div>
            <div><span className="text-gray-500">Total Items:</span> <span className="text-white">{image.results.length}</span></div>
          </div>
        </div>

        <div>
          <h5 className="text-gray-400 mb-2">Category Breakdown</h5>
          <div className="text-white">
            {image.results.length > 0 ? getCategoryBreakdown(image.results) : 'No items'}
          </div>
        </div>
      </div>

      {image.results.length > 0 && (
        <div>
          <h5 className="text-gray-400 mb-2">Detected Items</h5>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {getItemDetails(image.results).map((item, index) => (
              <div key={index} className="bg-gray-800/50 rounded p-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{item.name}</span>
                  <span className="text-gray-400">({item.category})</span>
                  {item.quantity > 1 && (
                    <span className="text-yellow-400">x{item.quantity}</span>
                  )}
                </div>
                <div className="text-gray-500 mt-1">
                  {item.rank && <span>Rank: {item.rank} </span>}
                  {item.rarity && <span>Rarity: {item.rarity} </span>}
                  {item.standingCost && <span>Standing: {item.standingCost.toLocaleString()} </span>}
                  {item.syndicate && <span>Syndicate: {item.syndicate}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {image.error && (
        <div className="flex items-center gap-2 text-red-400">
          <AlertTriangle size={14} />
          <span className="text-sm">Error: {image.error}</span>
        </div>
      )}

      <div className="text-xs text-gray-500">
        <p>This debug info shows exactly what was detected and parsed from the image.</p>
        <p>Use this to verify if the screen type detection and item parsing are working correctly.</p>
      </div>
    </div>
  );
};

export default DebugInfo;