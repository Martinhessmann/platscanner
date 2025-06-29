// Purpose: Render a toggleable inventory section for a specific item category
// Supports Story #8: Extended Item Support with separate sections for different item types

import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Trash2, ChevronDown, ChevronRight, Zap, Coins } from 'lucide-react';
import { InventoryItem } from '../services/inventoryService';
import { ItemCategory, VoidRelic } from '../types';
import ResultsTable from './ResultsTable';
import RelicResultsTable from './RelicResultsTable';
import LastRefreshInfo from './LastRefreshInfo';

interface InventorySectionProps {
  category: ItemCategory;
  title: string;
  icon: React.ReactNode;
  items: InventoryItem[];
  totalValue: number;
  totalDucats: number;
  isRefreshing: boolean;
  progress?: { category: string; current: number; total: number };
  lastRefreshTime?: Date | null;
  onRefreshAll: () => void;
  onClearAll: () => void;
  onRefreshItem: (itemName: string) => void;
  onRemoveItem: (itemName: string) => void;
}

const getCategoryDisplayName = (category: ItemCategory): string => {
  switch (category) {
    case 'prime_parts':
      return 'Prime Parts';
    case 'relics':
      return 'Void Relics';
    default:
      return category;
  }
};

const InventorySection: React.FC<InventorySectionProps> = ({
  category,
  title,
  icon,
  items,
  totalValue,
  totalDucats,
  isRefreshing,
  progress,
  lastRefreshTime,
  onRefreshAll,
  onClearAll,
  onRefreshItem,
  onRemoveItem
}) => {
  const sectionRef = useRef<HTMLDivElement>(null);

  // Persistent accordion state based on category
  const getStorageKey = () => `accordion_${category}`;

  const [isExpanded, setIsExpanded] = useState(() => {
    const stored = localStorage.getItem(getStorageKey());
    return stored !== null ? JSON.parse(stored) : true;
  });

  // Save accordion state to localStorage
  useEffect(() => {
    localStorage.setItem(getStorageKey(), JSON.stringify(isExpanded));
  }, [isExpanded, category]);

  // Auto-scroll to section when collapsing
  const handleToggle = () => {
    if (isExpanded && sectionRef.current) {
      // Scroll to top of section when collapsing
      sectionRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
    setIsExpanded(!isExpanded);
  };

  if (items.length === 0) {
    return null; // Don't render empty sections
  }

  const getRefreshButtonText = () => {
    if (isRefreshing && progress) {
      return `${progress.current}/${progress.total}`;
    }
    return 'Refresh';
  };

  return (
    <div ref={sectionRef} className="mb-2">
      {/* Mobile-first sticky header */}
      <div className="bg-gray-900/50 backdrop-blur-sm p-3 rounded-t-xl border border-gray-700/50 border-b-0 sticky top-0 z-20">
        <button
          onClick={handleToggle}
          className="flex items-center justify-between w-full text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {isExpanded ? (
                <ChevronDown size={16} className="text-gray-400 group-hover:text-orokin-gold transition-colors" />
              ) : (
                <ChevronRight size={16} className="text-gray-400 group-hover:text-orokin-gold transition-colors" />
              )}
              {icon}
            </div>
            <div>
              <h3 className="font-semibold text-white group-hover:text-orokin-gold transition-colors">
                {title}
              </h3>
              <p className="text-xs text-gray-400">
                {items.length} item{items.length !== 1 ? 's' : ''}
                {isRefreshing && progress && (
                  <span className="text-tenno-blue ml-2">
                    • Refreshing {progress.current}/{progress.total}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="flex items-center justify-end gap-1 mb-1">
              <Zap size={14} className="text-gray-300" />
              <span className="text-lg font-bold text-gray-300">{totalValue}</span>
            </div>
            {category === 'prime_parts' && (
              <div className="flex items-center justify-end gap-1">
                <Coins size={10} className="text-yellow-500" />
                <span className="text-xs text-yellow-500">{totalDucats}</span>
              </div>
            )}
          </div>
        </button>

        {/* Action buttons - only show when expanded */}
        {isExpanded && items.length > 0 && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-700/50">
            <div className="flex items-center gap-2">
              <button
                onClick={onRefreshAll}
                disabled={isRefreshing}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isRefreshing
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-tenno-blue/10 hover:bg-tenno-blue/20 text-tenno-blue border border-tenno-blue/20'
                }`}
                title={`Refresh all ${getCategoryDisplayName(category).toLowerCase()}`}
              >
                <RefreshCw
                  size={14}
                  className={isRefreshing ? 'animate-spin' : ''}
                />
                {getRefreshButtonText()}
              </button>

              <button
                onClick={onClearAll}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-grineer-red/10 hover:bg-grineer-red/20 text-grineer-red border border-grineer-red/20 transition-colors"
                title={`Clear all ${getCategoryDisplayName(category).toLowerCase()}`}
              >
                <Trash2 size={14} />
                Clear
              </button>
            </div>

                        <LastRefreshInfo
              lastRefreshDate={lastRefreshTime || null}
              className="ml-auto"
            />
          </div>
        )}

        {/* Progress bar - show when refreshing */}
        {isRefreshing && progress && (
          <div className="mt-3 pt-3 border-t border-gray-700/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Refreshing prices...</span>
              <span className="text-xs text-gray-400">
                {progress.current} / {progress.total}
              </span>
            </div>
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-tenno-blue transition-all duration-300"
                style={{
                  width: `${(progress.current / progress.total) * 100}%`
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-700/50 border-t-0 rounded-b-xl overflow-hidden">
          {category === 'relics' ? (
            <RelicResultsTable
              results={items as VoidRelic[]}
              onRemoveItem={onRemoveItem}
              onRefreshItem={onRefreshItem}
              showActionButtons={true}
            />
          ) : (
            <ResultsTable
              results={items}
              onRemoveItem={onRemoveItem}
              onRefreshItem={onRefreshItem}
              showActionButtons={true}
            />
          )}
        </div>
      )}

      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full bg-gray-800/30 backdrop-blur-sm border border-gray-700/50 border-t-0 rounded-b-xl text-center p-3 hover:bg-gray-800/50 transition-colors"
        >
          <p className="text-gray-400 text-sm hover:text-gray-300 transition-colors">
            Tap to view {items.length} {getCategoryDisplayName(category).toLowerCase()}
          </p>
        </button>
      )}
    </div>
  );
};

export default InventorySection;