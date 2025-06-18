import React, { useState } from 'react';
import { DetectedItem } from '../types';
import { ArrowUpDown, ExternalLink, AlertCircle, Coins, Trash2, RefreshCw, Filter, Zap, MoreVertical } from 'lucide-react';

interface ResultsTableProps {
  results: DetectedItem[];
  isLoading?: boolean;
  onRemoveItem?: (itemName: string) => void;
  onRefreshItem?: (itemName: string) => void;
  showActionButtons?: boolean;
}

const ResultsTable: React.FC<ResultsTableProps> = ({
  results,
  isLoading = false,
  onRemoveItem,
  onRefreshItem,
  showActionButtons = false
}) => {
  const [sortField, setSortField] = useState<'price' | 'name' | 'ducats'>('price');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showSortOptions, setShowSortOptions] = useState(false);
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);

  const handleSort = (field: 'price' | 'name' | 'ducats') => {
    console.log(`>>> [ResultsTable] Sort clicked: ${field}, current: ${sortField}, direction: ${sortDirection} <<<`);

    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'name' ? 'asc' : 'desc');
    }
    setShowSortOptions(false);

    console.log(`>>> [ResultsTable] Sort applied: field=${field}, direction=${sortDirection === 'asc' ? 'desc' : 'asc'} <<<`);
  };

  const sortedResults = [...results].sort((a, b) => {
    if (sortField === 'price') {
      const priceA = a.price || 0;
      const priceB = b.price || 0;
      const result = sortDirection === 'asc' ? priceA - priceB : priceB - priceA;
      return result;
    } else if (sortField === 'ducats') {
      const ducatsA = a.ducats || 0;
      const ducatsB = b.ducats || 0;
      const result = sortDirection === 'asc' ? ducatsA - ducatsB : ducatsB - ducatsA;
      return result;
    } else {
      const result = sortDirection === 'asc'
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
      return result;
    }
  });

  // Debug logging
  console.log(`>>> [ResultsTable] Sorting by ${sortField} ${sortDirection}, first 3 items:`,
    sortedResults.slice(0, 3).map(item => ({
      name: item.name,
      price: item.price,
      ducats: item.ducats
    }))
  );

  if (isLoading && results.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-2 p-2 animate-pulse">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="bg-gray-800 rounded-lg h-32 opacity-60"></div>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center p-8 m-4 border border-dashed border-gray-700 rounded-lg">
        <p className="text-gray-400">No items detected yet.</p>
        <p className="text-sm text-gray-500 mt-1">Upload a screenshot to analyze your inventory.</p>
      </div>
    );
  }

  const getSortLabel = () => {
    const direction = sortDirection === 'asc' ? '↑' : '↓';
    switch (sortField) {
      case 'price': return `Plat ${direction}`;
      case 'ducats': return `Ducats ${direction}`;
      case 'name': return `Name ${direction}`;
    }
  };

  return (
    <div className="w-full">
      {/* Mobile-first sort header */}
      <div className="flex items-center justify-between p-3 bg-gray-900/50">
        <div className="text-sm text-gray-400">
          {results.length} item{results.length !== 1 ? 's' : ''}
        </div>
        <div className="relative">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowSortOptions(!showSortOptions);
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg text-sm text-gray-300 hover:bg-gray-700 transition-colors"
          >
            <Filter size={14} />
            {getSortLabel()}
          </button>

          {showSortOptions && (
            <div className="absolute right-0 top-full mt-1 bg-gray-800 rounded-lg border border-gray-700 shadow-xl z-50 min-w-32">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSort('price');
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 rounded-t-lg flex items-center gap-2"
              >
                <Zap size={12} className="text-gray-300" />
                Plat {sortField === 'price' && (sortDirection === 'asc' ? '↑' : '↓')}
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSort('ducats');
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
              >
                <Coins size={12} className="text-yellow-500" />
                Ducats {sortField === 'ducats' && (sortDirection === 'asc' ? '↑' : '↓')}
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSort('name');
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 rounded-b-lg flex items-center gap-2"
              >
                Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile-first 50/50 grid cards */}
      <div key={`${sortField}-${sortDirection}`} className="grid grid-cols-2 gap-2 p-2">
        {sortedResults.map((item) => (
          <div
            key={item.id}
            className="bg-gray-800/50 rounded-lg overflow-hidden border border-gray-700/50 hover:border-orokin-gold/30 transition-all duration-200 relative group"
          >
            {/* Item image and main info */}
            <div className="relative">
              {item.imgUrl ? (
                <img
                  src={item.imgUrl}
                  alt={item.name}
                  className="w-full h-20 object-cover bg-gray-900"
                />
              ) : (
                <div className="w-full h-20 bg-gray-900 flex items-center justify-center">
                  <AlertCircle size={20} className="text-gray-500" />
                </div>
              )}

              {/* 3-dots meatball menu for mobile-friendly actions */}
              {showActionButtons && (onRefreshItem || onRemoveItem) && (
                <div className="absolute top-1 right-1">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setActiveActionMenu(activeActionMenu === item.id ? null : item.id);
                    }}
                    className="p-1.5 rounded-md backdrop-blur-sm bg-black/50 text-gray-300 hover:text-white transition-colors"
                    title="Actions"
                  >
                    <MoreVertical size={12} />
                  </button>

                  {/* Action dropdown menu */}
                  {activeActionMenu === item.id && (
                    <div className="absolute right-0 top-full mt-1 bg-gray-800 rounded-lg border border-gray-700 shadow-xl z-50 min-w-32">
                      {onRefreshItem && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onRefreshItem(item.name);
                            setActiveActionMenu(null);
                          }}
                          disabled={item.status === 'loading'}
                          className={`w-full text-left px-3 py-2 text-sm rounded-t-lg flex items-center gap-2 transition-colors ${
                            item.status === 'loading'
                              ? 'text-gray-500 cursor-not-allowed'
                              : 'text-tenno-blue hover:bg-gray-700'
                          }`}
                        >
                          <RefreshCw size={12} className={item.status === 'loading' ? 'animate-spin' : ''} />
                          Refresh price
                        </button>
                      )}
                      {onRemoveItem && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onRemoveItem(item.name);
                            setActiveActionMenu(null);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-grineer-red hover:bg-gray-700 rounded-b-lg flex items-center gap-2 transition-colors"
                        >
                          <Trash2 size={12} />
                          Remove
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Price overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                {item.status === 'loading' && (
                  <div className="h-4 w-16 bg-gray-700 rounded animate-pulse"></div>
                )}
                {item.status === 'error' && (
                  <span className="text-grineer-red flex items-center gap-1 text-xs">
                    <AlertCircle size={10} />
                    Error
                  </span>
                )}
                {item.status === 'loaded' && (
                  <div className="flex items-center justify-between">
                    {item.error ? (
                      <span className="text-gray-400 flex items-center gap-1 text-xs">
                        <AlertCircle size={10} />
                        {item.error}
                      </span>
                    ) : (
                      <>
                        {/* Relic Value Display */}
                        {item.category === 'relics' && 'expectedDropValue' in item && item.expectedDropValue ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                <Zap size={12} className="text-orange-400" />
                                <span className="text-orange-400 font-bold text-lg">{Math.round(item.expectedDropValue)}</span>
                                <span className="text-gray-400 text-xs">exp</span>
                              </div>
                              {item.recommendation && (
                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                  item.recommendation === 'OPEN' ? 'bg-green-900/50 text-green-400' :
                                  item.recommendation === 'SELL' ? 'bg-green-900/50 text-green-400' :
                                  'bg-yellow-900/50 text-yellow-400'
                                }`}>
                                  {item.recommendation === 'REFINE_THEN_OPEN' ? 'REFINE' : item.recommendation}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-400">
                              <span>Min: {item.minDropValue || 0}</span>
                              <span>Max: {item.maxDropValue || 0}</span>
                            </div>
                          </div>
                        ) : (
                          /* Prime Parts and Regular Relics Display */
                          <div className="flex items-center gap-3">
                            {/* Platinum - Large and Silver */}
                            <div className="flex items-center gap-1">
                              <Zap size={14} className="text-gray-300" />
                              <span className="text-gray-300 font-bold text-xl">{item.price || 0}</span>
                            </div>
                            {/* Ducats - Smaller and Yellow */}
                            {item.ducats && (
                              <div className="flex items-center gap-1">
                                <Coins size={10} className="text-yellow-500" />
                                <span className="text-yellow-500 text-sm font-medium">{item.ducats}</span>
                              </div>
                            )}
                          </div>
                        )}
                        <a
                          href={`https://warframe.market/items/${item.name.toLowerCase().replace(/ /g, '_')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-tenno-blue hover:text-tenno-light p-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink size={12} />
                        </a>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Item name and details */}
            <div className="p-2">
              <h3 className="font-medium text-white text-sm leading-tight line-clamp-2 mb-1">
                {item.name}
              </h3>
              {item.status === 'loaded' && item.average && !item.error && (
                <div className="text-gray-400 text-xs">
                  Avg: {item.average}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Tap outside to close sort options */}
      {showSortOptions && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowSortOptions(false)}
        />
      )}

      {/* Tap outside to close action menu */}
      {activeActionMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setActiveActionMenu(null)}
        />
      )}
    </div>
  );
};

export default ResultsTable;