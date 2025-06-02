import React, { useState } from 'react';
import { PrimePart } from '../types';
import { ArrowUpDown, ExternalLink, AlertCircle, Coins } from 'lucide-react';

interface ResultsTableProps {
  results: PrimePart[];
  isLoading: boolean;
}

const ResultsTable: React.FC<ResultsTableProps> = ({ results, isLoading }) => {
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

  if (isLoading) {
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
            <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-200 sm:pl-6">
              <button 
                onClick={() => handleSort('name')}
                className="group inline-flex items-center gap-x-2"
              >
                Item
                <ArrowUpDown 
                  size={16} 
                  className={`text-gray-400 group-hover:text-orokin-gold transition-colors ${sortField === 'name' ? 'text-orokin-gold' : ''}`} 
                />
              </button>
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-200">
              <button 
                onClick={() => handleSort('price')}
                className="group inline-flex items-center gap-x-2"
              >
                Best Buyer
                <ArrowUpDown 
                  size={16} 
                  className={`text-gray-400 group-hover:text-orokin-gold transition-colors ${sortField === 'price' ? 'text-orokin-gold' : ''}`} 
                />
              </button>
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-200">
              <button 
                onClick={() => handleSort('ducats')}
                className="group inline-flex items-center gap-x-2"
              >
                <Coins size={16} className="text-orokin-gold" />
                Ducats
                <ArrowUpDown 
                  size={16} 
                  className={`text-gray-400 group-hover:text-orokin-gold transition-colors ${sortField === 'ducats' ? 'text-orokin-gold' : ''}`} 
                />
              </button>
            </th>
            <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800 bg-background-card">
          {sortedResults.map((item) => (
            <tr key={item.id} className="hover:bg-background-light transition-colors">
              <td className="py-4 pl-4 pr-3 text-sm sm:pl-6">
                <div className="flex items-start gap-3">
                  {item.imgUrl ? (
                    <img 
                      src={item.imgUrl} 
                      alt={item.name} 
                      className="h-10 w-10 flex-shrink-0 rounded bg-background-dark object-cover border border-gray-700" 
                    />
                  ) : (
                    <div className="h-10 w-10 flex-shrink-0 rounded bg-background-dark flex items-center justify-center border border-gray-700">
                      <AlertCircle size={16} className="text-gray-500" />
                    </div>
                  )}
                  <span className="font-medium text-white break-words">{item.name}</span>
                </div>
              </td>
              <td className="px-3 py-4 text-sm">
                {item.status === 'loading' && (
                  <div className="h-5 w-20 bg-gray-700 rounded animate-pulse"></div>
                )}
                {item.status === 'error' && (
                  <span className="text-grineer-red flex items-center gap-1">
                    <AlertCircle size={14} />
                    Error
                  </span>
                )}
                {item.status === 'loaded' && (
                  <div className="break-words">
                    {item.error ? (
                      <span className="text-gray-400 flex items-center gap-1">
                        <AlertCircle size={14} />
                        {item.error}
                      </span>
                    ) : (
                      <div className="space-y-1">
                        <div>
                          <span className="text-orokin-gold font-semibold">{item.price}</span>
                          <span className="text-gray-400 ml-1">platinum</span>
                        </div>
                        {item.average && (
                          <div className="text-gray-400 text-xs">
                            Avg: {item.average}
                          </div>
                        )}
                        {item.volume && (
                          <div className="text-gray-400 text-xs">
                            {item.volume} orders
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </td>
              <td className="px-3 py-4 text-sm">
                {item.ducats ? (
                  <div className="flex items-center gap-1">
                    <Coins size={14} className="text-orokin-gold" />
                    <span className="font-medium">{item.ducats}</span>
                  </div>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
              <td className="relative py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                <a
                  href={`https://warframe.market/items/${item.name.toLowerCase().replace(/ /g, '_')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-tenno-blue hover:text-tenno-light flex items-center justify-end gap-1 transition-colors"
                >
                  View <ExternalLink size={14} />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ResultsTable;