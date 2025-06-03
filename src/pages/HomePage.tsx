import React, { useState, useCallback, useEffect } from 'react';
import ImageUploader from '../components/ImageUploader';
import ProcessingAnimation from '../components/ProcessingAnimation';
import ResultsTable from '../components/ResultsTable';
import { analyzeImage, isGeminiConfigured } from '../services/geminiService';
import { fetchPriceData, fetchSinglePriceData } from '../services/warframeMarketService';
import {
  saveToInventory,
  loadInventory,
  removeFromInventory,
  clearInventory,
  updateInventoryPrices,
  getInventoryStats,
  InventoryItem
} from '../services/inventoryService';
import { ImageState, PrimePart, ProcessingState } from '../types';
import InfoCard from '../components/InfoCard';
import { FileWithPath } from 'react-dropzone';
import { RefreshCw, Package, Trash2, Archive } from 'lucide-react';

const HomePage: React.FC = () => {
  const [processingState, setProcessingState] = useState<ProcessingState>({
    activeImageId: null,
    images: new Map(),
    combinedResults: new Map(), // Keep for compatibility, but won't be used
    processedCount: 0,
    totalCount: 0
  });

  const [lastPriceRefresh, setLastPriceRefresh] = useState<Date | null>(null);
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);

  // Story #3: Persistent Inventory State
  const [persistentInventory, setPersistentInventory] = useState<InventoryItem[]>([]);
  const [showInventory, setShowInventory] = useState(true); // Show by default

  // Load persistent inventory on component mount
  useEffect(() => {
    const inventory = loadInventory();
    setPersistentInventory(inventory.items);
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
          // Extract prime parts using Gemini AI
          const detectedParts = await analyzeImage(nextImage.file);

          // Map the detected part names to PrimePart objects
          const parts: PrimePart[] = detectedParts.map((name, index) => ({
            id: `${nextImage.id}-part-${index}`,
            name,
            status: 'loading'
          }));

                    // Filter out items already in inventory to avoid duplicates
          const currentInventory = loadInventory();
          const existingItemNames = new Set(currentInventory.items.map(item => item.name));
          const newParts = parts.filter(part => !existingItemNames.has(part.name));

          console.log(`Detected ${parts.length} items, ${newParts.length} are new, ${parts.length - newParts.length} already in inventory`);

          if (newParts.length === 0) {
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
              results: newParts
            })
          }));

          // Fetch prices individually and update inventory as they come in
          const sessionId = `scan_${Date.now()}`;
          const processedParts: PrimePart[] = [];

          for (const part of newParts) {
            try {
              // Fetch price for individual item
              const partWithPrice = await fetchSinglePriceData(part);
              processedParts.push(partWithPrice);

              // Add to inventory immediately as it's processed
              saveToInventory([partWithPrice], sessionId);

              // Update local inventory state
              const updatedInventory = loadInventory();
              setPersistentInventory(updatedInventory.items);

              console.log(`Added ${partWithPrice.name} to inventory with price ${partWithPrice.price}`);
            } catch (error) {
              console.error(`Failed to process ${part.name}:`, error);
              const errorPart = { ...part, status: 'error' as const, error: 'Failed to fetch price' };
              processedParts.push(errorPart);
            }
          }

          // Mark image as complete
          setProcessingState(final => ({
            ...final,
            images: new Map(final.images).set(nextImage.id, {
              ...nextImage,
              status: 'complete',
              results: processedParts
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
  }, []); // Keep empty dependency array since we use functional setState

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

    // Removed old handleRefreshPrices - using individual refresh and inventory refresh instead

  // Story #3: Inventory Management Functions
  const handleRemoveFromInventory = useCallback((itemName: string) => {
    removeFromInventory(itemName);
    setPersistentInventory(prev => prev.filter(item => item.name !== itemName));
  }, []);

  const handleClearInventory = useCallback(() => {
    clearInventory();
    setPersistentInventory([]);
  }, []);

  // Individual item price refresh
  const handleRefreshSingleItem = useCallback(async (itemName: string) => {
    const item = persistentInventory.find(item => item.name === itemName);
    if (!item) return;

    // Update item to loading state
    setPersistentInventory(prev =>
      prev.map(inventoryItem =>
        inventoryItem.name === itemName
          ? { ...inventoryItem, status: 'loading' as const }
          : inventoryItem
      )
    );

    try {
      // Fetch updated price for single item
      const updatedItem = await fetchSinglePriceData(item);

      // Update persistent storage
      updateInventoryPrices([updatedItem]);

      // Update local state
      setPersistentInventory(prev =>
        prev.map(inventoryItem =>
          inventoryItem.name === itemName
            ? { ...inventoryItem, ...updatedItem, addedAt: inventoryItem.addedAt }
            : inventoryItem
        )
      );
    } catch (error) {
      console.error(`Failed to refresh ${itemName}:`, error);

      // Set error state
      setPersistentInventory(prev =>
        prev.map(inventoryItem =>
          inventoryItem.name === itemName
            ? {
                ...inventoryItem,
                status: 'error' as const,
                error: 'Failed to refresh price'
              }
            : inventoryItem
        )
      );
    }
  }, [persistentInventory]);

  const handleRefreshInventoryPrices = useCallback(async () => {
    if (persistentInventory.length === 0 || isRefreshingPrices) {
      return;
    }

    setIsRefreshingPrices(true);

    try {
      // Convert inventory items to PrimePart array
      const itemsToRefresh: PrimePart[] = persistentInventory.map(item => ({
        ...item,
        status: 'loading'
      }));

      // Fetch updated prices
      const updatedItems = await fetchPriceData(itemsToRefresh);

      // Update persistent inventory
      updateInventoryPrices(updatedItems);

      // Update local state
      const updatedInventory = loadInventory();
      setPersistentInventory(updatedInventory.items);

      setLastPriceRefresh(new Date());
    } catch (error) {
      console.error('Error refreshing inventory prices:', error);
    } finally {
      setIsRefreshingPrices(false);
    }
  }, [persistentInventory, isRefreshingPrices]);

  const inventoryStats = getInventoryStats();

  return (
    <main className="flex-grow container mx-auto px-4 py-8">
      <div className="max-w-5xl mx-auto relative">
        {/* Hero section */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            <span className="text-orokin-gold">Prime Part</span> Scanner
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Upload screenshots of your Warframe inventory and our AI will identify Prime parts
            and fetch current market prices to help you maximize your profits.
          </p>

          {!isGeminiConfigured() && (
            <div className="mt-4 p-4 bg-background-card rounded-lg border border-yellow-500/20">
              <p className="text-yellow-500 text-sm">
                Please configure your Gemini API key using the settings icon in the top-right corner to enable AI scanning.
              </p>
            </div>
          )}
        </div>

        {/* Main content area */}
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
                <h2 className="text-xl font-semibold mb-2">Ready to Scan</h2>
                <p className="text-gray-400">
                  Upload screenshots of your Warframe inventory to begin scanning for Prime parts.
                </p>
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

                        {/* Story #3: Persistent Inventory Section */}
            <div className="bg-background-card rounded-lg border border-gray-800 p-4 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowInventory(!showInventory)}
                    className="flex items-center gap-2 text-xl font-semibold hover:text-orokin-gold transition-colors"
                  >
                    <Package size={24} />
                    My Inventory
                    <span className="text-sm font-normal text-gray-400">
                      ({persistentInventory.length} items)
                    </span>
                  </button>

                  {persistentInventory.length > 0 && (
                    <div className="text-sm text-gray-400 space-x-4">
                      <span className="text-orokin-gold font-medium">{inventoryStats.totalValue}p</span>
                      <span className="text-yellow-500">{inventoryStats.totalDucats} ducats</span>
                    </div>
                  )}
                </div>

                {persistentInventory.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRefreshInventoryPrices}
                      disabled={isRefreshingPrices}
                      className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${
                        isRefreshingPrices
                          ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                          : 'bg-tenno-blue hover:bg-tenno-light text-white'
                      }`}
                    >
                      <RefreshCw
                        size={14}
                        className={isRefreshingPrices ? 'animate-spin' : ''}
                      />
                      Refresh All
                    </button>

                    <button
                      onClick={handleClearInventory}
                      className="flex items-center gap-1 px-3 py-2 rounded text-sm font-medium bg-grineer-red hover:bg-red-600 text-white transition-colors"
                    >
                      <Trash2 size={14} />
                      Clear All
                    </button>
                  </div>
                )}
              </div>

              {persistentInventory.length === 0 ? (
                <div className="text-center p-8 border border-dashed border-gray-700 rounded-lg">
                  <Package size={48} className="mx-auto text-gray-500 mb-3" />
                  <p className="text-gray-400 mb-2">Your inventory is empty</p>
                  <p className="text-sm text-gray-500">Upload screenshots to start building your inventory</p>
                </div>
              ) : showInventory ? (
                <ResultsTable
                  results={persistentInventory}
                  onRemoveItem={handleRemoveFromInventory}
                  onRefreshItem={handleRefreshSingleItem}
                  showActionButtons={true}
                />
              ) : (
                <div className="text-center p-4">
                  <p className="text-gray-400 text-sm">
                    Click "My Inventory" to view your {persistentInventory.length} items
                  </p>
                </div>
              )}
            </div>

            {/* Current Scan section removed - using persistent inventory instead */}

            {/* How it Works */}
            <InfoCard />
          </div>
        </div>
      </div>
    </main>
  );
};

export default HomePage;