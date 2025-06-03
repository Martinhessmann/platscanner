// Purpose: Render a toggleable inventory section for a specific item category
// Supports Story #8: Extended Item Support with separate sections for different item types

import React, { useState } from 'react';
import { RefreshCw, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { InventoryItem } from '../services/inventoryService';
import { ItemCategory } from '../types';
import ResultsTable from './ResultsTable';

interface InventorySectionProps {
  category: ItemCategory;
  title: string;
  icon: React.ReactNode;
  items: InventoryItem[];
  totalValue: number;
  totalDucats: number;
  isRefreshing: boolean;
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
  onRefreshAll,
  onClearAll,
  onRefreshItem,
  onRemoveItem
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (items.length === 0) {
    return null; // Don't render empty sections
  }

  return (
    <div className="bg-background-card rounded-lg border border-gray-800 p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-3 text-lg font-semibold hover:text-orokin-gold transition-colors group"
        >
          {isExpanded ? (
            <ChevronDown size={20} className="text-gray-400 group-hover:text-orokin-gold" />
          ) : (
            <ChevronRight size={20} className="text-gray-400 group-hover:text-orokin-gold" />
          )}
          {icon}
          {title}
          <span className="text-sm font-normal text-gray-400">
            ({items.length} items)
          </span>
        </button>

        <div className="flex items-center gap-4">
          {items.length > 0 && (
            <div className="text-sm text-gray-400 space-x-4">
              <span className="text-orokin-gold font-medium">{totalValue}p</span>
              {category === 'prime_parts' && (
                <span className="text-yellow-500">{totalDucats} ducats</span>
              )}
            </div>
          )}

          {items.length > 0 && isExpanded && (
            <div className="flex items-center gap-2">
              <button
                onClick={onRefreshAll}
                disabled={isRefreshing}
                className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${
                  isRefreshing
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-tenno-blue hover:bg-tenno-light text-white'
                }`}
                title={`Refresh all ${getCategoryDisplayName(category).toLowerCase()}`}
              >
                <RefreshCw
                  size={14}
                  className={isRefreshing ? 'animate-spin' : ''}
                />
                Refresh
              </button>

              <button
                onClick={onClearAll}
                className="flex items-center gap-1 px-3 py-2 rounded text-sm font-medium bg-grineer-red hover:bg-red-600 text-white transition-colors"
                title={`Clear all ${getCategoryDisplayName(category).toLowerCase()}`}
              >
                <Trash2 size={14} />
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {isExpanded && (
        <ResultsTable
          results={items}
          onRemoveItem={onRemoveItem}
          onRefreshItem={onRefreshItem}
          showActionButtons={true}
        />
      )}

      {!isExpanded && (
        <div className="text-center p-2">
          <p className="text-gray-400 text-sm">
            Click to view {items.length} {getCategoryDisplayName(category).toLowerCase()}
          </p>
        </div>
      )}
    </div>
  );
};

export default InventorySection;