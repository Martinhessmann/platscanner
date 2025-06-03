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
import { RefreshCw, Package, Trash2, Archive, Zap, Key } from 'lucide-react';

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

          // Fetch prices individually and update inventory as they come in
          const sessionId = `scan_${Date.now()}`;
          const processedItems: DetectedItem[] = [];

          for (const item of newItems) {
            try {
              // Fetch price for individual item
              const itemWithPrice = await fetchSinglePriceData(item);
              processedItems.push(itemWithPrice);

              // Add to inventory immediately as it's processed
              saveToInventory([itemWithPrice], sessionId);

              // Update local inventory state
              const updatedInventory = getCategorizedInventory();
              setCategorizedInventory(updatedInventory);

              console.log(`Added ${itemWithPrice.name} to inventory with price ${itemWithPrice.price}`);
            } catch (error) {
              console.error(`Failed to process ${item.name}:`, error);
              const errorItem = { ...item, status: 'error' as const, error: 'Failed to fetch price' };
              processedItems.push(errorItem);
            }
          }

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
    // Find item in either category
    const primeItem = categorizedInventory.prime_parts.find(item => item.name === itemName);
    const relicItem = categorizedInventory.relics.find(item => item.name === itemName);
    const item = primeItem || relicItem;
    const category = primeItem ? 'prime_parts' : 'relics';

    if (!item) return;

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

      // Update persistent storage
      updateInventoryPrices([updatedItem]);

      // Update local state
      setCategorizedInventory(prev => ({
        ...prev,
        [category]: prev[category].map(inventoryItem =>
          inventoryItem.name === itemName
            ? { ...inventoryItem, ...updatedItem, addedAt: inventoryItem.addedAt }
            : inventoryItem
        )
      }));
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

    try {
      // Fetch updated prices
      const updatedItems = await fetchPriceData(items);

      // Update persistent inventory
      updateInventoryPrices(updatedItems);

      // Update local state
      const updatedInventory = getCategorizedInventory();
      setCategorizedInventory(updatedInventory);

      setLastPriceRefresh(new Date());
    } catch (error) {
      console.error(`Error refreshing ${category} prices:`, error);
    } finally {
      setRefreshingCategories(prev => {
        const updated = new Set(prev);
        updated.delete(category);
        return updated;
      });
    }
  }, [categorizedInventory, refreshingCategories]);

  const inventoryStats = getInventoryStats();

  return (
    <main className="min-h-screen bg-background-dark">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left column - Upload */}
          <div className="lg:col-span-5 space-y-6">
            <ImageUploader
              onImageUpload={handleImageUpload}
              isProcessing={isProcessing}
              images={processingState.images}
              activeImageId={processingState.activeImageId}
              onImageSelect={id => setProcessingState(prev => ({ ...prev, activeImageId: id }))}
              onImageRemove={handleImageRemove}
            />

            {processingState.totalCount > 0 && (
              <div className="bg-background-card rounded-lg p-4 border border-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Processing Progress</span>
                  <span className="text-sm text-gray-400">
                    {processingState.processedCount} / {processingState.totalCount}
                  </span>
                </div>
                <div className="h-2 bg-background-light rounded-full overflow-hidden">
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
          <div className="lg:col-span-7 space-y-6">
            {!activeImage && processingState.images.size === 0 && (
              <div className="bg-background-card rounded-lg border border-gray-800 p-6 text-center">
                {isConfigured ? (
                  <>
                    <h2 className="text-xl font-semibold mb-2">Ready to Scan</h2>
                    <p className="text-gray-400">
                      Upload screenshots of your Warframe inventory to begin scanning for Prime parts and Void relics.
                    </p>
                  </>
                ) : (
                  <>
                    <Key size={48} className="mx-auto text-orokin-gold mb-3" />
                    <h2 className="text-xl font-semibold mb-2">API Key Required</h2>
                    <p className="text-gray-400 mb-4">
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
              <div className="bg-background-card rounded-lg border border-gray-800 p-6">
                <ProcessingAnimation stage={
                  activeImage?.status === 'analyzing' ? 'analyzing' :
                  activeImage?.status === 'fetching' ? 'fetching' :
                  'analyzing'
                } />
              </div>
            )}

            {/* Story #8: Categorized Inventory Sections */}
            {(categorizedInventory.prime_parts.length > 0 || categorizedInventory.relics.length > 0) && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Package size={24} />
                    My Inventory
                    <span className="text-sm font-normal text-gray-400">
                      ({inventoryStats.totalItems} items)
                    </span>
                  </h2>
                  <div className="text-sm text-gray-400 space-x-4">
                    <span className="text-orokin-gold font-medium">{inventoryStats.totalValue}p</span>
                    <span className="text-yellow-500">{inventoryStats.totalDucats} ducats</span>
                  </div>
                </div>

                {/* Prime Parts Section */}
                <InventorySection
                  category="prime_parts"
                  title="Prime Parts"
                  icon={<Package size={20} className="text-orokin-gold" />}
                  items={categorizedInventory.prime_parts}
                  totalValue={inventoryStats.byCategory.prime_parts.value}
                  totalDucats={inventoryStats.byCategory.prime_parts.ducats}
                  isRefreshing={refreshingCategories.has('prime_parts')}
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
                  onRefreshAll={() => handleRefreshCategoryPrices('relics')}
                  onClearAll={() => handleClearInventory('relics')}
                  onRefreshItem={handleRefreshSingleItem}
                  onRemoveItem={handleRemoveFromInventory}
                />
              </div>
            )}

            {/* Empty state */}
            {categorizedInventory.prime_parts.length === 0 && categorizedInventory.relics.length === 0 && (
              <div className="bg-background-card rounded-lg border border-gray-800 p-6 text-center">
                <Package size={48} className="mx-auto text-gray-500 mb-3" />
                <p className="text-gray-400 mb-2">Your inventory is empty</p>
                <p className="text-sm text-gray-500">Upload screenshots to start building your inventory</p>
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