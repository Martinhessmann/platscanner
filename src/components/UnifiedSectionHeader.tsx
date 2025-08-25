// Purpose: Unified header component for all inventory sections
// Ensures consistent UI/UX language across Prime Parts, Void Relics, Prime Sets, and Syndicate Rewards

import React from 'react';
import { ChevronDown, ChevronRight, RefreshCw, Trash2 } from 'lucide-react';
import LastRefreshInfo from './LastRefreshInfo';

interface UnifiedSectionHeaderProps {
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  onRefresh?: () => void;
  onClear?: () => void;
  isRefreshing?: boolean;
  progress?: { current: number; total: number };
  lastRefreshTime?: Date | null;
  children?: React.ReactNode; // For custom info line content
  showClearButton?: boolean;
  refreshTitle?: string;
  clearTitle?: string;
}

const UnifiedSectionHeader: React.FC<UnifiedSectionHeaderProps> = ({
  title,
  icon,
  isExpanded,
  onToggle,
  onRefresh,
  onClear,
  isRefreshing = false,
  progress,
  lastRefreshTime,
  children,
  showClearButton = true,
  refreshTitle = 'Refresh',
  clearTitle = 'Clear all'
}) => {
  return (
    <div className="bg-gray-900/50 backdrop-blur-sm p-3 rounded-t-xl border border-gray-700/50 border-b-0 sticky top-0 z-20">
      <div className="flex items-center justify-between w-full">
        <button
          onClick={onToggle}
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
            {/* Unified info line - customizable per section */}
            <div className="flex items-center gap-3 text-xs text-gray-400">
              {children}
              {isRefreshing && progress && (
                <span className="text-tenno-blue">
                  Refreshing {progress.current}/{progress.total}
                </span>
              )}
            </div>
          </div>
        </button>

        {/* Unified action buttons with consistent spacing */}
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                isRefreshing
                  ? 'text-gray-500 cursor-not-allowed'
                  : 'text-tenno-blue hover:bg-tenno-blue/10'
              }`}
              title={refreshTitle}
            >
              <RefreshCw
                size={12}
                className={isRefreshing ? 'animate-spin' : ''}
              />
              {isRefreshing && progress ? `${progress.current}/${progress.total}` : ''}
            </button>
          )}

          {showClearButton && onClear && (
            <button
              onClick={onClear}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-grineer-red hover:bg-grineer-red/10 transition-colors"
              title={clearTitle}
            >
              <Trash2 size={12} />
            </button>
          )}

          {/* Single timestamp location - removed duplicates */}
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
  );
};

export default UnifiedSectionHeader;
