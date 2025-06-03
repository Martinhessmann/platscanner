import React, { useState } from 'react';
import { PrimePart } from '../types';
import { ArrowUpDown, ExternalLink, AlertCircle, Coins, Trash2, RefreshCw } from 'lucide-react';

interface ResultsTableProps {
  results: PrimePart[];
  isLoading?: boolean; // Made optional since we handle individual item loading
  onRemoveItem?: (itemName: string) => void; // For persistent inventory management
  onRefreshItem?: (itemName: string) => void; // For individual price refresh
  showActionButtons?: boolean; // Whether to show action buttons (remove, refresh)
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

  const handleSort = (field: 'price' | 'name' | 'ducats') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'name' ? 'asc' : 'desc');
    }
  };

  const sortedResults = [...results].sort((a, b) => {
    if (sortField === 'price') {
      const priceA = a.price || 0;
      const priceB = b.price || 0;
      return sortDirection === 'asc' ? priceA - priceB : priceB - priceA;
    } else if (sortField === 'ducats') {
      const ducatsA = a.ducats || 0;
      const ducatsB = b.ducats || 0;
      return sortDirection === 'asc' ? ducatsA - ducatsB : ducatsB - ducatsA;
    } else {
      return sortDirection === 'asc'
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    }
  });

  // Only show skeleton loading for initial load, not for price refresh
  if (isLoading && results.length === 0) {
    return (
      <div className="animate-pulse">
        <div className="h-10 bg-background-card rounded mb-4"></div>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-16 bg-background-card rounded mb-2 opacity-60"></div>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center p-8 border border-dashed border-gray-700 rounded-lg">
        <p className="text-gray-400">No items detected yet.</p>
        <p className="text-sm text-gray-500 mt-1">Upload a screenshot to analyze your inventory.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-800 bg-background-card">
      <table className="min-w-full divide-y divide-gray-800">
        <thead className="bg-background-light">
          <tr>
            <th scope="col" className="py-3 pl-4 pr-3 text-left text-xs font-semibold text-gray-200 sm:pl-6">
              <button
                onClick={() => handleSort('name')}
                className="group inline-flex items-center gap-x-1"
              >
                Item
                <ArrowUpDown
                  size={12}
                  className={`text-gray-400 group-hover:text-orokin-gold transition-colors ${sortField === 'name' ? 'text-orokin-gold' : ''}`}
                />
              </button>
            </th>
            <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-200">
              <button
                onClick={() => handleSort('price')}
                className="group inline-flex items-center gap-x-1"
              >
                Plat
                <ArrowUpDown
                  size={12}
                  className={`text-gray-400 group-hover:text-orokin-gold transition-colors ${sortField === 'price' ? 'text-orokin-gold' : ''}`}
                />
              </button>
            </th>
            <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-200">
              <button
                onClick={() => handleSort('ducats')}
                className="group inline-flex items-center gap-x-1"
              >
                <Coins size={12} className="text-orokin-gold" />
                <ArrowUpDown
                  size={12}
                  className={`text-gray-400 group-hover:text-orokin-gold transition-colors ${sortField === 'ducats' ? 'text-orokin-gold' : ''}`}
                />
              </button>
            </th>
            <th scope="col" className="relative py-3 pl-3 pr-4 sm:pr-6">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800 bg-background-card">
          {sortedResults.map((item) => (
            <tr key={item.id} className="hover:bg-background-light transition-colors">
              <td className="py-3 pl-4 pr-3 text-xs sm:pl-6">
                <div className="flex items-start gap-2">
                  {item.imgUrl ? (
                    <img
                      src={item.imgUrl}
                      alt={item.name}
                      className="h-8 w-8 flex-shrink-0 rounded bg-background-dark object-cover border border-gray-700"
                    />
                  ) : (
                    <div className="h-8 w-8 flex-shrink-0 rounded bg-background-dark flex items-center justify-center border border-gray-700">
                      <AlertCircle size={14} className="text-gray-500" />
                    </div>
                  )}
                  <span className="font-medium text-white break-words">{item.name}</span>
                </div>
              </td>
              <td className="px-3 py-3 text-xs">
                {item.status === 'loading' && (
                  <div className="h-4 w-16 bg-gray-700 rounded animate-pulse"></div>
                )}
                {item.status === 'error' && (
                  <span className="text-grineer-red flex items-center gap-1">
                    <AlertCircle size={12} />
                    Error
                  </span>
                )}
                {item.status === 'loaded' && (
                  <div className="break-words">
                    {item.error ? (
                      <span className="text-gray-400 flex items-center gap-1">
                        <AlertCircle size={12} />
                        {item.error}
                      </span>
                    ) : (
                      <div className="space-y-0.5">
                        <div>
                          <span className="text-orokin-gold font-semibold">{item.price}</span>
                        </div>
                        {item.average && (
                          <div className="text-gray-400 text-[10px]">
                            Avg: {item.average}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </td>
              <td className="px-3 py-3 text-xs">
                {item.ducats ? (
                  <div className="flex items-center gap-1">
                    <span className="font-medium">{item.ducats}</span>
                  </div>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
              <td className="relative py-3 pl-3 pr-4 text-right text-xs font-medium sm:pr-6">
                <div className="flex items-center justify-end gap-2">
                  {showActionButtons && onRefreshItem && (
                    <button
                      onClick={() => onRefreshItem(item.name)}
                      disabled={item.status === 'loading'}
                      className={`transition-colors ${
                        item.status === 'loading'
                          ? 'text-gray-500 cursor-not-allowed'
                          : 'text-tenno-blue hover:text-tenno-light'
                      }`}
                      title="Refresh price"
                    >
                      <RefreshCw size={14} className={item.status === 'loading' ? 'animate-spin' : ''} />
                    </button>
                  )}
                  {showActionButtons && onRemoveItem && (
                    <button
                      onClick={() => onRemoveItem(item.name)}
                      className="text-grineer-red hover:text-red-400 transition-colors"
                      title="Remove from inventory"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <a
                    href={`https://warframe.market/items/${item.name.toLowerCase().replace(/ /g, '_')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-tenno-blue hover:text-tenno-light"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ResultsTable;