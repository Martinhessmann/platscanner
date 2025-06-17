import React, { useState, useCallback, useEffect } from 'react';
import ImageUploader from '../components/ImageUploader';
import ProcessingAnimation from '../components/ProcessingAnimation';
import InventorySection from '../components/InventorySection';
import { analyzeImage, isGeminiConfigured } from '../services/geminiService';
import { fetchPriceData, fetchSinglePriceData } from '../services/warframeMarketService';
import {
  saveToInventory,
  loadInventory,
  removeFromInventory,
  clearInventoryByCategory,
  updateInventoryPrices,
  getInventoryStats,
  getCategorizedInventory,
  InventoryItem
} from '../services/inventoryService';
import { ImageState, DetectedItem, ProcessingState } from '../types';
import InfoCard from '../components/InfoCard';
import { FileWithPath } from 'react-dropzone';
import { RefreshCw, Package, Trash2, Archive, Zap, Key, Coins } from 'lucide-react';

interface HomePageProps {
  isConfigured: boolean;
  onOpenSettings: () => void;
}

const HomePage: React.FC<HomePageProps> = ({ isConfigured, onOpenSettings }) => {
  const [processingState, setProcessingState] = useState<ProcessingState>({
    activeImageId: null,
    images: new Map(),
    combinedResults: new Map(), // Keep for compatibility, but won't be used
    processedCount: 0,
    totalCount: 0
  });

  const [lastPriceRefresh, setLastPriceRefresh] = useState<Date | null>(null);
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);
  const [refreshingCategories, setRefreshingCategories] = useState<Set<string>>(new Set());
  const [fetchingProgress, setFetchingProgress] = useState<{ current: number; total: number } | undefined>(undefined);
  const [categoryProgress, setCategoryProgress] = useState<{ category: string; current: number; total: number } | undefined>(undefined);

  // Story #3 & #8: Categorized Persistent Inventory State
  const [categorizedInventory, setCategorizedInventory] = useState({
    prime_parts: [] as InventoryItem[],
    relics: [] as InventoryItem[]
  });

  // Load persistent inventory on component mount
  useEffect(() => {
    const inventory = getCategorizedInventory();
    setCategorizedInventory(inventory);
  }, []);

  // Process the next image in the queue
  const processNextImage = useCallback(async () => {
    setProcessingState(prev => {
      // Get all queued images from current state
      const queuedImages = Array.from(prev.images.values())
        .filter(img => img.status === 'queued');

      if (queuedImages.length === 0) return prev;

      const nextImage = queuedImages[0];

      // Start processing immediately by updating status
      const newImages = new Map(prev.images);
      newImages.set(nextImage.id, {
        ...nextImage,
        status: 'analyzing'
      });

      // Trigger async processing
      (async () => {
        try {
          // Extract items using Gemini AI (now supports both Prime parts and Relics)
          const detectedItems = await analyzeImage(nextImage.file);

          // Filter out items already in inventory to avoid duplicates
          const currentInventory = loadInventory();
          const existingItemNames = new Set(currentInventory.items.map(item => item.name));
          const newItems = detectedItems.filter(item => !existingItemNames.has(item.name));

          console.log(`Detected ${detectedItems.length} items, ${newItems.length} are new, ${detectedItems.length - newItems.length} already in inventory`);

          if (newItems.length === 0) {
            // No new items to process
            setProcessingState(current => ({
              ...current,
              images: new Map(current.images).set(nextImage.id, {
                ...nextImage,
                status: 'complete',
                results: []
              }),
              processedCount: current.processedCount + 1
            }));
            return;
          }

          // Update status to fetching for new items only
          setProcessingState(current => ({
            ...current,
            images: new Map(current.images).set(nextImage.id, {
              ...nextImage,
              status: 'fetching',
              results: newItems
            })
          }));

          // Initialize progress tracking
          setFetchingProgress({ current: 0, total: newItems.length });

          // Fetch prices individually and update inventory as they come in
          const sessionId = `scan_${Date.now()}`;
          const processedItems: DetectedItem[] = [];

          for (let index = 0; index < newItems.length; index++) {
            const item = newItems[index];
            try {
              // Fetch price for individual item
              const itemWithPrice = await fetchSinglePriceData(item);
              processedItems.push(itemWithPrice);

              // Add to inventory immediately as it's processed
              saveToInventory([itemWithPrice], sessionId);

              // Update local inventory state
              const updatedInventory = getCategorizedInventory();
              setCategorizedInventory(updatedInventory);

              // Update progress after processing each item
              setFetchingProgress({ current: index + 1, total: newItems.length });

              console.log(`Added ${itemWithPrice.name} to inventory with price ${itemWithPrice.price} (${index + 1}/${newItems.length})`);
            } catch (error) {
              console.error(`Failed to process ${item.name}:`, error);
              const errorItem = { ...item, status: 'error' as const, error: 'Failed to fetch price' };
              processedItems.push(errorItem);

              // Update progress even for failed items
              setFetchingProgress({ current: index + 1, total: newItems.length });
            }
          }

          // Clear progress tracking when done
          setFetchingProgress(undefined);

          // Mark image as complete
          setProcessingState(final => ({
            ...final,
            images: new Map(final.images).set(nextImage.id, {
              ...nextImage,
              status: 'complete',
              results: processedItems
            }),
            processedCount: final.processedCount + 1
          }));

        } catch (error) {
          console.error('Error processing image:', error);
          setProcessingState(errorState => ({
            ...errorState,
            images: new Map(errorState.images).set(nextImage.id, {
              ...nextImage,
              status: 'error',
              error: error instanceof Error ? error.message : 'Unknown error'
            }),
            processedCount: errorState.processedCount + 1
          }));
        }
      })();

      return {
        ...prev,
        activeImageId: nextImage.id,
        images: newImages
      };
    });
  }, []);

  // Watch for changes in the queue and process next image
  useEffect(() => {
    // Don't start processing if API key is not configured
    if (!isGeminiConfigured()) {
      return;
    }

    const queuedImages = Array.from(processingState.images.values())
      .filter(img => img.status === 'queued');

    const processingImages = Array.from(processingState.images.values())
      .filter(img => ['analyzing', 'fetching'].includes(img.status));

    if (queuedImages.length > 0 && processingImages.length === 0) {
      processNextImage();
    }
  }, [processingState.images, processNextImage]);

  // Start processing when API key becomes available
  useEffect(() => {
    if (isGeminiConfigured()) {
      const queuedImages = Array.from(processingState.images.values())
        .filter(img => img.status === 'queued');

      const processingImages = Array.from(processingState.images.values())
        .filter(img => ['analyzing', 'fetching'].includes(img.status));

      if (queuedImages.length > 0 && processingImages.length === 0) {
        processNextImage();
      }
    }
  }, [processNextImage]); // This will trigger when the component mounts or when processNextImage changes

  const handleImageUpload = useCallback((files: FileWithPath[]) => {
    setProcessingState(prev => {
      const newImages = new Map(prev.images);

      files.forEach(file => {
        const id = `img-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const state: ImageState = {
          id,
          file,
          preview: URL.createObjectURL(file),
          status: 'queued',
          results: []
        };
        newImages.set(id, state);
      });

      return {
        ...prev,
        images: newImages,
        activeImageId: Array.from(newImages.keys())[0] || prev.activeImageId,
        totalCount: prev.totalCount + files.length
      };
    });
  }, []);

  const handleImageRemove = useCallback((id: string) => {
    setProcessingState(prev => {
      const newImages = new Map(prev.images);

      // Remove the image
      newImages.delete(id);

      // Update active image if needed
      let newActiveId = prev.activeImageId;
      if (newActiveId === id) {
        const remainingIds = Array.from(newImages.keys());
        newActiveId = remainingIds[0] || null;
      }

      return {
        ...prev,
        images: newImages,
        activeImageId: newActiveId,
        processedCount: Math.max(0, prev.processedCount - 1),
        totalCount: Math.max(0, prev.totalCount - 1)
      };
    });
  }, []);

  const activeImage = processingState.activeImageId
    ? processingState.images.get(processingState.activeImageId)
    : null;

  const isProcessing = activeImage?.status === 'analyzing' || activeImage?.status === 'fetching';

  // Story #3: Inventory Management Functions
  const handleRemoveFromInventory = useCallback((itemName: string) => {
    removeFromInventory(itemName);
    setCategorizedInventory(prev => ({
      ...prev,
      prime_parts: prev.prime_parts.filter(item => item.name !== itemName),
      relics: prev.relics.filter(item => item.name !== itemName)
    }));
  }, []);

  const handleClearInventory = useCallback((category: 'prime_parts' | 'relics') => {
    clearInventoryByCategory(category);
    setCategorizedInventory(prev => ({
      ...prev,
      [category]: []
    }));
  }, []);

  // Individual item price refresh
  const handleRefreshSingleItem = useCallback(async (itemName: string) => {
    console.log(`>>> [HomePage] Refreshing single item: ${itemName} <<<`);

    // Find item in either category
    const primeItem = categorizedInventory.prime_parts.find(item => item.name === itemName);
    const relicItem = categorizedInventory.relics.find(item => item.name === itemName);
    const item = primeItem || relicItem;
    const category = primeItem ? 'prime_parts' : 'relics';

    if (!item) {
      console.log(`>>> [HomePage] Item not found: ${itemName} <<<`);
      return;
    }

    console.log(`>>> [HomePage] Current item status: ${item.status}, price: ${item.price} <<<`);

    // Update item to loading state
    setCategorizedInventory(prev => ({
      ...prev,
      [category]: prev[category].map(inventoryItem =>
        inventoryItem.name === itemName
          ? { ...inventoryItem, status: 'loading' as const }
          : inventoryItem
      )
    }));

    try {
      // Fetch updated price for single item
      const updatedItem = await fetchSinglePriceData(item);

      console.log(`>>> [HomePage] Fetched updated item: ${updatedItem.name}, status: ${updatedItem.status}, price: ${updatedItem.price} <<<`);

      // Update persistent storage
      updateInventoryPrices([updatedItem]);

      // Update local state - preserve addedAt and merge new data
      setCategorizedInventory(prev => ({
        ...prev,
        [category]: prev[category].map(inventoryItem =>
          inventoryItem.name === itemName
            ? { ...inventoryItem, ...updatedItem, addedAt: inventoryItem.addedAt }
            : inventoryItem
        )
      }));

      console.log(`>>> [HomePage] Updated local state for: ${itemName} <<<`);
    } catch (error) {
      console.error(`Failed to refresh ${itemName}:`, error);

      // Set error state
      setCategorizedInventory(prev => ({
        ...prev,
        [category]: prev[category].map(inventoryItem =>
          inventoryItem.name === itemName
            ? {
                ...inventoryItem,
                status: 'error' as const,
                error: 'Failed to refresh price'
              }
            : inventoryItem
        )
      }));
    }
  }, [categorizedInventory]);

  // Category-specific refresh handlers
  const handleRefreshCategoryPrices = useCallback(async (category: 'prime_parts' | 'relics') => {
    const items = categorizedInventory[category];
    if (items.length === 0 || refreshingCategories.has(category)) {
      return;
    }

    setRefreshingCategories(prev => new Set(prev).add(category));
    setCategoryProgress({ category, current: 0, total: items.length });

    // Set all items in category to loading state first
    setCategorizedInventory(prev => ({
      ...prev,
      [category]: prev[category].map(item => ({ ...item, status: 'loading' as const }))
    }));

    try {
      const updatedItems: InventoryItem[] = [];

      // Process items one by one to provide progress feedback
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        console.log(`>>> [HomePage] Category refresh processing ${i + 1}/${items.length}: ${item.name} <<<`);

        try {
          const updatedItem = await fetchSinglePriceData(item);
          updatedItems.push({
            ...updatedItem,
            addedAt: item.addedAt,
            lastUpdated: Date.now()
          });
          console.log(`>>> [HomePage] Category refresh updated: ${updatedItem.name}, status: ${updatedItem.status}, price: ${updatedItem.price} <<<`);
        } catch (error) {
          console.error(`Failed to fetch price for ${item.name}:`, error);
          updatedItems.push({
            ...item,
            status: 'error',
            error: 'Failed to fetch price',
            lastUpdated: Date.now()
          });
        }

        // Update progress
        setCategoryProgress({ category, current: i + 1, total: items.length });

        // Update state progressively as items are processed
        setCategorizedInventory(prev => {
          const newState = { ...prev };
          const updatedItem = updatedItems[updatedItems.length - 1];

          newState[category] = prev[category].map(inventoryItem =>
            inventoryItem.name === updatedItem.name
              ? { ...inventoryItem, ...updatedItem, addedAt: inventoryItem.addedAt }
              : inventoryItem
          );

          return newState;
        });
      }

      // Update persistent inventory
      updateInventoryPrices(updatedItems);

      setLastPriceRefresh(new Date());
      console.log(`>>> [HomePage] Category refresh completed for ${updatedItems.length} items <<<`);
    } catch (error) {
      console.error(`Error refreshing ${category} prices:`, error);
    } finally {
      setRefreshingCategories(prev => {
        const updated = new Set(prev);
        updated.delete(category);
        return updated;
      });
      setCategoryProgress(undefined);
    }
  }, [categorizedInventory, refreshingCategories]);

  // Refresh all market prices
  const handleRefreshPrices = useCallback(async () => {
    console.log('>>> [HomePage] Starting bulk price refresh <<<');

    const allItems = [...categorizedInventory.prime_parts, ...categorizedInventory.relics];

    if (allItems.length === 0) {
      console.log('>>> [HomePage] No items to refresh <<<');
      return;
    }

    console.log(`>>> [HomePage] Found ${allItems.length} items to refresh <<<`);
    setFetchingProgress({ current: 0, total: allItems.length });
    setProcessingState('fetching');

    // Set all items to loading state first
    setCategorizedInventory(prev => ({
      prime_parts: prev.prime_parts.map(item => ({ ...item, status: 'loading' as const })),
      relics: prev.relics.map(item => ({ ...item, status: 'loading' as const }))
    }));

    try {
      const updatedItems: InventoryItem[] = [];

      for (let i = 0; i < allItems.length; i++) {
        const item = allItems[i];
        console.log(`>>> [HomePage] Bulk refresh processing ${i + 1}/${allItems.length}: ${item.name} <<<`);

        try {
          const updatedItem = await fetchSinglePriceData(item);
          updatedItems.push({
            ...updatedItem,
            addedAt: item.addedAt,
            lastUpdated: Date.now()
          });
          console.log(`>>> [HomePage] Bulk refresh updated: ${updatedItem.name}, status: ${updatedItem.status}, price: ${updatedItem.price} <<<`);
        } catch (error) {
          console.error(`Failed to fetch price for ${item.name}:`, error);
          updatedItems.push({
            ...item,
            status: 'error',
            error: 'Failed to fetch price',
            lastUpdated: Date.now()
          });
        }

        setFetchingProgress({ current: i + 1, total: allItems.length });
      }

      // Update persistent storage
      updateInventoryPrices(updatedItems);

      // Update state with all fetched items
      const primeUpdatedItems = updatedItems.filter(item => item.category === 'prime');
      const relicUpdatedItems = updatedItems.filter(item => item.category === 'relic');

      setCategorizedInventory({
        prime_parts: primeUpdatedItems,
        relics: relicUpdatedItems
      });
      console.log(`>>> [HomePage] Bulk refresh completed for ${updatedItems.length} items <<<`);
    } catch (error) {
      console.error('Failed to refresh prices:', error);
    } finally {
      setProcessingState('idle');
      setFetchingProgress({ current: 0, total: 0 });
    }
  }, [categorizedInventory]);

  const inventoryStats = getInventoryStats();

  return (
    <main className="min-h-screen bg-background-dark">
      <div className="max-w-screen-2xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 lg:gap-4">
          {/* Left column - Upload */}
          <div className="lg:col-span-2 space-y-3 p-3 lg:p-4">
            <ImageUploader
              onImageUpload={handleImageUpload}
              isProcessing={isProcessing}
              images={processingState.images}
              activeImageId={processingState.activeImageId}
              onImageSelect={id => setProcessingState(prev => ({ ...prev, activeImageId: id }))}
              onImageRemove={handleImageRemove}
            />

            {processingState.totalCount > 0 && (
              <div className="bg-gray-800/40 backdrop-blur-sm rounded-xl p-3 border border-gray-700/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">Processing Progress</span>
                  <span className="text-xs text-gray-400">
                    {processingState.processedCount} / {processingState.totalCount}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-tenno-blue transition-all duration-300"
                    style={{
                      width: `${(processingState.processedCount / processingState.totalCount) * 100}%`
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right column - Processing and Results */}
          <div className="lg:col-span-3 space-y-3 p-3 lg:p-4">
            {!activeImage && processingState.images.size === 0 && (
              <div className="bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-700/50 p-4 text-center">
                {isConfigured ? (
                  <>
                    <h2 className="text-lg font-semibold mb-2">Ready to Scan</h2>
                    <p className="text-gray-400 text-sm">
                      Upload screenshots of your Warframe inventory to begin scanning for Prime parts and Void relics.
                    </p>
                  </>
                ) : (
                  <>
                    <Key size={40} className="mx-auto text-orokin-gold mb-3" />
                    <h2 className="text-lg font-semibold mb-2">API Key Required</h2>
                    <p className="text-gray-400 mb-4 text-sm">
                      Please add your Gemini API key to start scanning your inventory.
                    </p>
                    <button
                      onClick={onOpenSettings}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-tenno-blue hover:bg-tenno-light text-white rounded-lg transition-colors"
                    >
                      <Key size={16} />
                      Add API Key
                    </button>
                    <p className="text-xs text-gray-500 mt-3">
                      Your API key is stored securely in your browser and never transmitted to our servers.
                    </p>
                  </>
                )}
              </div>
            )}

            {isProcessing && (
              <div className="bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-700/50 p-4">
                <ProcessingAnimation
                  stage={
                    activeImage?.status === 'analyzing' ? 'analyzing' :
                    activeImage?.status === 'fetching' ? 'fetching' :
                    'analyzing'
                  }
                  progress={activeImage?.status === 'fetching' ? fetchingProgress : undefined}
                />
              </div>
            )}

            {/* Story #8: Categorized Inventory Sections */}
            {(categorizedInventory.prime_parts.length > 0 || categorizedInventory.relics.length > 0) && (
              <div className="space-y-2">

                {/* Prime Parts Section */}
                <InventorySection
                  category="prime_parts"
                  title="Prime Parts"
                  icon={<Package size={20} className="text-orokin-gold" />}
                  items={categorizedInventory.prime_parts}
                  totalValue={inventoryStats.byCategory.prime_parts.value}
                  totalDucats={inventoryStats.byCategory.prime_parts.ducats}
                  isRefreshing={refreshingCategories.has('prime_parts')}
                  progress={categoryProgress?.category === 'prime_parts' ? categoryProgress : undefined}
                  onRefreshAll={() => handleRefreshCategoryPrices('prime_parts')}
                  onClearAll={() => handleClearInventory('prime_parts')}
                  onRefreshItem={handleRefreshSingleItem}
                  onRemoveItem={handleRemoveFromInventory}
                />

                {/* Void Relics Section */}
                <InventorySection
                  category="relics"
                  title="Void Relics"
                  icon={<Zap size={20} className="text-purple-400" />}
                  items={categorizedInventory.relics}
                  totalValue={inventoryStats.byCategory.relics.value}
                  totalDucats={inventoryStats.byCategory.relics.ducats}
                  isRefreshing={refreshingCategories.has('relics')}
                  progress={categoryProgress?.category === 'relics' ? categoryProgress : undefined}
                  onRefreshAll={() => handleRefreshCategoryPrices('relics')}
                  onClearAll={() => handleClearInventory('relics')}
                  onRefreshItem={handleRefreshSingleItem}
                  onRemoveItem={handleRemoveFromInventory}
                />
              </div>
            )}

            {/* Empty state */}
            {categorizedInventory.prime_parts.length === 0 && categorizedInventory.relics.length === 0 && (
              <div className="bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-700/50 p-4 text-center">
                <Package size={40} className="mx-auto text-gray-500 mb-3" />
                <p className="text-gray-400 mb-2">Your inventory is empty</p>
                <p className="text-xs text-gray-500">Upload screenshots to start building your inventory</p>
              </div>
            )}

            {/* How it Works */}
            <InfoCard isConfigured={isConfigured} onOpenSettings={onOpenSettings} />
          </div>
        </div>
      </div>
    </main>
  );
};

export default HomePage;