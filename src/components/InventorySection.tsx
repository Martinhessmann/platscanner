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
    return stored !== null ? JSON.parse(stored) : false;
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


  return (
    <div ref={sectionRef} className="mb-2">
      {/* Mobile-first sticky header */}
      <div className="bg-gray-900/50 backdrop-blur-sm p-3 rounded-t-xl border border-gray-700/50 border-b-0 sticky top-0 z-20">
        <div className="flex items-center justify-between w-full">
          <button
            onClick={handleToggle}
            className="flex items-center gap-3 text-left group flex-1"
          >
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
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span>
                  {items.length} item{items.length !== 1 ? 's' : ''}
                </span>
                {totalValue > 0 && (
                  <div className="flex items-center gap-1">
                    <Zap size={10} className="text-gray-300" />
                    <span className="text-gray-300">{totalValue}p</span>
                  </div>
                )}
                {category === 'prime_parts' && totalDucats > 0 && (
                  <div className="flex items-center gap-1">
                    <Coins size={10} className="text-yellow-500" />
                    <span className="text-yellow-500">{totalDucats}d</span>
                  </div>
                )}
                {isRefreshing && progress && (
                  <span className="text-tenno-blue">
                    Refreshing {progress.current}/{progress.total}
                  </span>
                )}
              </div>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefreshAll}
              disabled={isRefreshing}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                isRefreshing
                  ? 'text-gray-500 cursor-not-allowed'
                  : 'text-tenno-blue hover:bg-tenno-blue/10'
              }`}
              title={`Refresh all ${getCategoryDisplayName(category).toLowerCase()}`}
            >
              <RefreshCw
                size={12}
                className={isRefreshing ? 'animate-spin' : ''}
              />
              {isRefreshing && progress ? `${progress.current}/${progress.total}` : ''}
            </button>

            <button
              onClick={onClearAll}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-grineer-red hover:bg-grineer-red/10 transition-colors"
              title={`Clear all ${getCategoryDisplayName(category).toLowerCase()}`}
            >
              <Trash2 size={12} />
            </button>

            {lastRefreshTime && (
              <LastRefreshInfo
                lastRefreshDate={lastRefreshTime}
                className="text-xs text-gray-500"
              />
            )}
          </div>
        </div>


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
              lastRefreshTime={lastRefreshTime}
            />
          ) : (
            <ResultsTable
              results={items}
              onRemoveItem={onRemoveItem}
              onRefreshItem={onRefreshItem}
              showActionButtons={true}
              lastRefreshTime={lastRefreshTime}
            />
          )}
        </div>
      )}

      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full bg-gray-800/30 backdrop-blur-sm border border-gray-700/50 border-t-0 rounded-b-xl p-4 hover:bg-gray-800/50 transition-colors group"
        >
          <div className="flex items-center justify-center text-sm">
            <span className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">
              Tap to expand
            </span>
          </div>
        </button>
      )}
    </div>
  );
};

export default InventorySection;