import React, { useState, useCallback, useEffect, useMemo } from 'react';
import ImageUploader from '../components/ImageUploader';
import ProcessingAnimation from '../components/ProcessingAnimation';
import InventorySection from '../components/InventorySection';
import SyndicateRewardsSection from '../components/SyndicateRewardsSection';
import { analyzeImage, isGeminiConfigured } from '../services/geminiService';
import { fetchPriceData, fetchSinglePriceData, fetchSinglePriceOnly } from '../services/warframeMarketService';
import { cloudSyncService } from '../services/cloudSyncService';
import { initializeStaticData } from '../services/staticDataService';
import {
  saveToInventory,
  loadInventory,
  removeFromInventory,
  clearInventoryByCategory,
  updateInventoryPrices,
  getInventoryStats,
  getCategorizedInventory,
  calculateRelicValueAnalysis,
  setLastRefreshTime,
  getLastRefreshTime,
  InventoryItem
} from '../services/inventoryService';
import { getPrimeSetsCache } from '../services/primeSetService';
import { ImageState, DetectedItem, ProcessingState, VoidRelic, SyndicateReward } from '../types';
import InfoCard from '../components/InfoCard';
import PrimeSetsSection from '../components/PrimeSetsSection';
import { FileWithPath } from 'react-dropzone';
import { RefreshCw, Package, Trash2, Archive, Zap, Key, Coins, Shield } from 'lucide-react';

interface HomePageProps {
  isConfigured: boolean;
  onOpenSettings: () => void;
  refreshTrigger?: number;
}

const HomePage: React.FC<HomePageProps> = ({ isConfigured, onOpenSettings, refreshTrigger }) => {
  const [processingState, setProcessingState] = useState<ProcessingState>({
    activeImageId: null,
    images: new Map(),
    combinedResults: new Map(), // Keep for compatibility, but won't be used
    processedCount: 0,
    totalCount: 0
  });

  const [lastPriceRefresh, setLastPriceRefresh] = useState<Date | null>(null);
  const [lastPrimePartsRefresh, setLastPrimePartsRefresh] = useState<Date | null>(null);
  const [lastRelicsRefresh, setLastRelicsRefresh] = useState<Date | null>(null);
  const [lastSyndicateRewardsRefresh, setLastSyndicateRewardsRefresh] = useState<Date | null>(null);
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);
  const [isRefreshingSyndicateRewards, setIsRefreshingSyndicateRewards] = useState(false);
  const [refreshingCategories, setRefreshingCategories] = useState<Set<string>>(new Set());
  const [fetchingProgress, setFetchingProgress] = useState<{ current: number; total: number } | undefined>(undefined);
  const [categoryProgress, setCategoryProgress] = useState<{ category: string; current: number; total: number } | undefined>(undefined);
  const [shouldStopProcessing, setShouldStopProcessing] = useState(false);

  // Story #3 & #8: Categorized Persistent Inventory State
  const [categorizedInventory, setCategorizedInventory] = useState({
    prime_parts: [] as InventoryItem[],
    relics: [] as InventoryItem[],
    syndicate_rewards: [] as InventoryItem[]
  });

  // Syndicate recommendations state (separate from inventory)
  const [syndicateRecommendations, setSyndicateRecommendations] = useState<SyndicateReward[]>([]);

  // Only sellable Prime Parts (uncrafted Blueprints)
  const sellablePrimeParts = useMemo(() => {
    return categorizedInventory.prime_parts.filter(item =>
      item.name.toLowerCase().endsWith(' blueprint')
    );
  }, [categorizedInventory.prime_parts]);

  // Totals for the sellable subset
  const sellablePrimePartsTotals = useMemo(() => {
    const value = sellablePrimeParts.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);
    const ducats = sellablePrimeParts.reduce((sum, item) => sum + ((item.ducats || 0) * (item.quantity || 1)), 0);
    return { value, ducats };
  }, [sellablePrimeParts]);

  // Handle syndicate rewards refresh - define early for use in useEffect
  const handleRefreshSyndicateRewards = useCallback(async () => {
    if (isRefreshingSyndicateRewards) return;

    console.log('>>> [HomePage] Starting syndicate rewards refresh <<<');
    setIsRefreshingSyndicateRewards(true);

    try {
      const { getAllSyndicateRewards, fetchSyndicateRewardPrices } = await import('../services/syndicateService');
      const allSyndicateRewards = getAllSyndicateRewards();

      if (allSyndicateRewards.length === 0) {
        console.log('>>> [HomePage] No syndicate rewards to refresh <<<');
        return;
      }

      console.log(`>>> [HomePage] Found ${allSyndicateRewards.length} syndicate rewards to refresh <<<`);
      const updatedRewards = await fetchSyndicateRewardPrices(allSyndicateRewards);

      // Update syndicate recommendations with fresh price data
      setSyndicateRecommendations(updatedRewards);
      setLastSyndicateRewardsRefresh(new Date());
      console.log(`>>> [HomePage] Syndicate rewards refresh completed for ${updatedRewards.length} items <<<`);
    } catch (error) {
      console.error('Failed to refresh syndicate rewards:', error);
    } finally {
      setIsRefreshingSyndicateRewards(false);
    }
  }, [isRefreshingSyndicateRewards]);

  // Load persistent inventory on component mount
  useEffect(() => {
    const inventory = getCategorizedInventory();
    setCategorizedInventory(inventory);

    // Load last refresh times
    setLastPrimePartsRefresh(getLastRefreshTime('prime_parts'));
    setLastRelicsRefresh(getLastRefreshTime('relics'));
  }, []);

  // Auto-fetch syndicate reward prices on initial load if configured and has syndicate rewards
  useEffect(() => {
    if (isConfigured && !isRefreshingSyndicateRewards && categorizedInventory.syndicate_rewards.length > 0) {
      console.log('>>> [HomePage] Auto-fetching syndicate rewards on app load <<<');
      handleRefreshSyndicateRewards();
    }
  }, [isConfigured, categorizedInventory.syndicate_rewards.length]); // Only auto-fetch if we have syndicate rewards

  // Refresh inventory when data is imported
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      const inventory = getCategorizedInventory();
      setCategorizedInventory(inventory);
    }
  }, [refreshTrigger]);

  // Initialize static data and auto-sync on app load
  useEffect(() => {
    // Initialize static data once on app startup
    const initializeApp = async () => {
      try {
        await initializeStaticData();
        console.log('✅ [App Init] Static data initialized');
      } catch (error) {
        console.error('❌ [App Init] Failed to initialize static data:', error);
      }
    };

    initializeApp();

    // Auto-sync functionality - try to sync when app loads and when API key is configured
    if (isConfigured && cloudSyncService.isAvailable()) {
      const syncSettings = cloudSyncService.getSyncSettings();
      if (syncSettings.isEnabled && syncSettings.autoSync) {
        console.log('>>> [Auto-Sync] Attempting auto-sync on app load <<<');
        cloudSyncService.autoSync().then(result => {
          if (result.success) {
            console.log('>>> [Auto-Sync] Successful - refreshing inventory <<<');
            const inventory = getCategorizedInventory();
            setCategorizedInventory(inventory);
          } else if (result.error && result.error !== 'Auto-sync disabled' && result.error !== 'No cloud data found') {
            console.log('>>> [Auto-Sync] Failed:', result.error, '<<<');
          }
        }).catch(error => {
          console.error('>>> [Auto-Sync] Error:', error, '<<<');
        });
      }
    }
  }, [isConfigured]); // Only run when API key configuration changes

  // Stop processing function
  const stopProcessing = useCallback(() => {
    setShouldStopProcessing(true);

    // Update any active image to complete status
    if (processingState.activeImageId) {
      setProcessingState(prev => {
        const activeImage = prev.images.get(prev.activeImageId!);
        if (activeImage && (activeImage.status === 'analyzing' || activeImage.status === 'fetching')) {
          const newImages = new Map(prev.images);
          newImages.set(prev.activeImageId!, {
            ...activeImage,
            status: 'complete',
            error: 'Processing stopped by user'
          });

          return {
            ...prev,
            images: newImages,
            processedCount: prev.processedCount + 1
          };
        }
        return prev;
      });
    }

    // Clear any category refreshes
    if (refreshingCategories.size > 0) {
      setRefreshingCategories(new Set());
      setCategoryProgress(undefined);

      // Reload inventory from storage to get consistent state
      const inventory = getCategorizedInventory();
      setCategorizedInventory(inventory);
    }

    // Clear bulk refresh state
    if (isRefreshingPrices) {
      setIsRefreshingPrices(false);
      setFetchingProgress(undefined);

      // Reload inventory from storage
      const inventory = getCategorizedInventory();
      setCategorizedInventory(inventory);
    }

    // Reset stop flag after a short delay
    setTimeout(() => {
      setShouldStopProcessing(false);
    }, 500);
  }, [processingState.activeImageId, refreshingCategories, isRefreshingPrices]);

  // Separate processing for AI analysis and price fetching
  const processImageAnalysis = useCallback(async () => {
    setProcessingState(prev => {
      // Get all queued images from current state
      const queuedImages = Array.from(prev.images.values())
        .filter(img => img.status === 'queued');

      if (queuedImages.length === 0) return prev;

      const nextImage = queuedImages[0];

      // Start AI analysis immediately by updating status
      const newImages = new Map(prev.images);
      newImages.set(nextImage.id, {
        ...nextImage,
        status: 'analyzing'
      });

      // Trigger async AI analysis only
      (async () => {
        try {
          console.log(`>>> [AI Analysis] Starting analysis for image: ${nextImage.id} <<<`);

          // Extract items using Gemini AI
          const detectedItems = await analyzeImage(nextImage.file);

          // Check if processing was stopped
          if (shouldStopProcessing) {
            setProcessingState(current => ({
              ...current,
              images: new Map(current.images).set(nextImage.id, {
                ...nextImage,
                status: 'complete',
                error: 'Processing stopped by user',
                results: []
              }),
              processedCount: current.processedCount + 1
            }));
            return;
          }

          // Handle syndicate rewards differently - they go to recommendations, not inventory
          const syndicateRewards = detectedItems.filter(item => item.category === 'syndicate_rewards');
          const nonSyndicateItems = detectedItems.filter(item => item.category !== 'syndicate_rewards');

          // For syndicate rewards, add them to recommendations
          if (syndicateRewards.length > 0) {
            console.log(`>>> [Syndicate] Adding ${syndicateRewards.length} syndicate rewards to recommendations <<<`);
            setSyndicateRecommendations(prev => {
              const existingNames = new Set(prev.map(r => r.name));
              const newRecommendations = syndicateRewards.filter(item => !existingNames.has(item.name));
              console.log(`>>> [Syndicate] New recommendations: ${newRecommendations.length}, Total: ${prev.length + newRecommendations.length} <<<`);
              return [...prev, ...newRecommendations];
            });
          }

          // For non-syndicate items, filter out items already in inventory to avoid duplicates
          let newItems: DetectedItem[] = [];
          if (nonSyndicateItems.length > 0) {
            const currentInventory = loadInventory();
            const existingItemNames = new Set(currentInventory.items.map(item => item.name));
            newItems = nonSyndicateItems.filter(item => !existingItemNames.has(item.name));
          }

          console.log(`>>> [AI Analysis] Detected ${detectedItems.length} items (${syndicateRewards.length} syndicate, ${nonSyndicateItems.length} others), ${newItems.length} are new <<<`);

          // Mark as complete if no items to process (both syndicate and non-syndicate)
          if (newItems.length === 0 && syndicateRewards.length === 0) {
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

          // Update status to 'analyzed' - ready for price fetching (even if only syndicate items)
          setProcessingState(current => ({
            ...current,
            images: new Map(current.images).set(nextImage.id, {
              ...nextImage,
              status: 'analyzed', // New status indicating ready for price fetching
              results: newItems,
              syndicateRewards: syndicateRewards // Store syndicate rewards for price fetching
            })
          }));

          console.log(`>>> [AI Analysis] Completed for image: ${nextImage.id}, queued for price fetching <<<`);

        } catch (error) {
          console.error('>>> [AI Analysis] Error:', error);
          setProcessingState(errorState => ({
            ...errorState,
            images: new Map(errorState.images).set(nextImage.id, {
              ...nextImage,
              status: 'error',
              error: error instanceof Error ? error.message : 'AI analysis failed'
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
  }, [shouldStopProcessing]);

  // Separate processing for price fetching
  const processPriceFetching = useCallback(async () => {
    setProcessingState(prev => {
      // Get images that have been analyzed but need price fetching
      const analyzedImages = Array.from(prev.images.values())
        .filter(img => img.status === 'analyzed');

      if (analyzedImages.length === 0) return prev;

      const nextImage = analyzedImages[0];
      const newItems = nextImage.results;

      // Check if this image had syndicate rewards (they would have been added to recommendations)
      // We need to fetch prices for both newItems and any syndicate rewards from this image
      const hasSyndicateRewards = nextImage.syndicateRewards && nextImage.syndicateRewards.length > 0;

      if (!newItems || newItems.length === 0) {
        // Mark as complete if no items to process
        const newImages = new Map(prev.images);
        newImages.set(nextImage.id, {
          ...nextImage,
          status: 'complete'
        });
        return {
          ...prev,
          images: newImages,
          processedCount: prev.processedCount + 1
        };
      }

      // Start price fetching
      const newImages = new Map(prev.images);
      newImages.set(nextImage.id, {
        ...nextImage,
        status: 'fetching'
      });

      // Trigger async price fetching
      (async () => {
        try {
          console.log(`>>> [Price Fetching] Starting price fetch for ${newItems.length} items from image: ${nextImage.id} <<<`);

          // Initialize progress tracking
          setFetchingProgress({ current: 0, total: newItems.length });

          // Fetch prices and update inventory as they come in
          const sessionId = `scan_${Date.now()}`;
          const processedItems: DetectedItem[] = [];

          for (let index = 0; index < newItems.length; index++) {
            // Check if processing was stopped
            if (shouldStopProcessing) {
              setProcessingState(current => ({
                ...current,
                images: new Map(current.images).set(nextImage.id, {
                  ...nextImage,
                  status: 'complete',
                  error: 'Processing stopped by user',
                  results: processedItems
                }),
                processedCount: current.processedCount + 1
              }));

              // Save any items processed so far
              if (processedItems.length > 0) {
                saveToInventory(processedItems, sessionId);
                const updatedInventory = getCategorizedInventory();
                setCategorizedInventory(updatedInventory);
              }
              return;
            }

            const item = newItems[index];
            console.log(`>>> [Price Fetching] Processing item ${index + 1}/${newItems.length}: ${item.name} <<<`);

            try {
              // Fetch price data for this item
              const priceData = await fetchSinglePriceData(item);

              if (priceData) {
                // Add to processed items with price data
                processedItems.push({
                  ...item,
                  price: priceData.price,
                  marketVolume: priceData.volume,
                  lastUpdated: new Date()
                });

                // Update progress
                setFetchingProgress({ current: index + 1, total: newItems.length });

                // Save to inventory immediately
                saveToInventory([processedItems[processedItems.length - 1]], sessionId);

                // Update categorized inventory display
                const updatedInventory = getCategorizedInventory();
                setCategorizedInventory(updatedInventory);

                console.log(`>>> [Price Fetching] Added ${item.name} to inventory with price ${priceData.price} (${index + 1}/${newItems.length}) <<<`);
              } else {
                console.log(`>>> [Price Fetching] No price data for ${item.name} <<<`);
                // Still add to processed items but without price
                processedItems.push({
                  ...item,
                  price: 0,
                  marketVolume: 0,
                  lastUpdated: new Date()
                });
                setFetchingProgress({ current: index + 1, total: newItems.length });
              }
            } catch (error) {
              console.error(`>>> [Price Fetching] Error fetching price for ${item.name}:`, error);
              // Add item without price data
              processedItems.push({
                ...item,
                price: 0,
                marketVolume: 0,
                lastUpdated: new Date()
              });
              setFetchingProgress({ current: index + 1, total: newItems.length });
            }

            // Small delay to avoid overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          // After processing regular items, handle syndicate rewards if any
          if (hasSyndicateRewards && nextImage.syndicateRewards) {
            console.log(`>>> [Price Fetching] Processing ${nextImage.syndicateRewards.length} syndicate rewards <<<`);

            // Update syndicate recommendations with prices
            setSyndicateRecommendations(prev => {
              const updatedRecommendations = [...prev];

              // Process each syndicate reward from this image
              nextImage.syndicateRewards.forEach(async (syndicateReward) => {
                try {
                  const priceData = await fetchSinglePriceData(syndicateReward);
                  if (priceData) {
                    // Find and update the recommendation with price data
                    const index = updatedRecommendations.findIndex(r => r.name === syndicateReward.name);
                    if (index >= 0) {
                      updatedRecommendations[index] = {
                        ...updatedRecommendations[index],
                        price: priceData.price,
                        marketVolume: priceData.volume,
                        lastUpdated: new Date()
                      };
                    }
                  }
                } catch (error) {
                  console.error(`>>> [Price Fetching] Error fetching price for syndicate reward ${syndicateReward.name}:`, error);
                }
              });

              return updatedRecommendations;
            });
          }

          // Mark as complete
          setProcessingState(current => ({
            ...current,
            images: new Map(current.images).set(nextImage.id, {
              ...nextImage,
              status: 'complete',
              results: processedItems
            }),
            processedCount: current.processedCount + 1
          }));

          console.log(`>>> [Price Fetching] Completed for image: ${nextImage.id} <<<`);

        } catch (error) {
          console.error('>>> [Price Fetching] Error:', error);
          setProcessingState(errorState => ({
            ...errorState,
            images: new Map(errorState.images).set(nextImage.id, {
              ...nextImage,
              status: 'error',
              error: error instanceof Error ? error.message : 'Price fetching failed'
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
  }, [shouldStopProcessing]);

  // Watch for changes and trigger AI analysis (can run in parallel with price fetching)
  useEffect(() => {
    if (!isGeminiConfigured()) return;

    const queuedImages = Array.from(processingState.images.values())
      .filter(img => img.status === 'queued');

    const analyzingImages = Array.from(processingState.images.values())
      .filter(img => img.status === 'analyzing');

    // Start AI analysis if we have queued images and no analysis in progress
    if (queuedImages.length > 0 && analyzingImages.length === 0) {
      console.log(`>>> [Parallel Processing] Starting AI analysis for ${queuedImages.length} queued images <<<`);
      processImageAnalysis();
    }
  }, [processingState.images, processImageAnalysis]);

  // Watch for analyzed images and trigger price fetching (can run in parallel with AI analysis)
  useEffect(() => {
    if (!isGeminiConfigured()) return;

    const analyzedImages = Array.from(processingState.images.values())
      .filter(img => img.status === 'analyzed');

    const fetchingImages = Array.from(processingState.images.values())
      .filter(img => img.status === 'fetching');

    // Start price fetching if we have analyzed images and no fetching in progress
    if (analyzedImages.length > 0 && fetchingImages.length === 0) {
      console.log(`>>> [Parallel Processing] Starting price fetching for ${analyzedImages.length} analyzed images <<<`);
      processPriceFetching();
    }
  }, [processingState.images, processPriceFetching]);

  // Legacy effect for backward compatibility (remove after testing)
  useEffect(() => {
    if (isGeminiConfigured()) {
      const queuedImages = Array.from(processingState.images.values())
        .filter(img => img.status === 'queued');

      const processingImages = Array.from(processingState.images.values())
        .filter(img => ['analyzing', 'fetching'].includes(img.status));

      if (queuedImages.length > 0 && processingImages.length === 0) {
        processImageAnalysis();
      }
    }
  }, []); // Empty dependency array for one-time trigger

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

  const isProcessing = activeImage?.status === 'analyzing' || activeImage?.status === 'analyzed' || activeImage?.status === 'fetching';

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

  // Clear only sellable (Blueprint) prime parts
  const handleClearSellablePrimeParts = useCallback(() => {
    const namesToRemove = new Set(sellablePrimeParts.map(i => i.name));
    namesToRemove.forEach(name => removeFromInventory(name));
    setCategorizedInventory(prev => ({
      ...prev,
      prime_parts: prev.prime_parts.filter(item => !namesToRemove.has(item.name))
    }));
  }, [sellablePrimeParts]);

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
      let updatedItem: DetectedItem;

      if (category === 'relics') {
        // For relics, fetch basic price data AND calculate relic value analysis
        const basicItem = await fetchSinglePriceOnly(item);

        // Calculate relic value analysis using the actual detected rarity and market price
        const relicItem = item as VoidRelic;
        const relicAnalysis = await calculateRelicValueAnalysis(
          itemName,
          relicItem.rarity || 'intact',
          basicItem.price || 0
        );

        if (relicAnalysis) {
          updatedItem = {
            ...basicItem,
            category: 'relics' as const,
            quantity: relicItem.quantity, // ✅ Preserve original quantity
            minDropValue: relicAnalysis.minDropValue,
            maxDropValue: relicAnalysis.maxDropValue,
            expectedDropValue: relicAnalysis.expectedDropValue,
            recommendation: relicAnalysis.recommendation,
            expectedProfit: relicAnalysis.expectedProfit,
            directSalePrice: relicAnalysis.directSalePrice,
            relicDrops: relicAnalysis.relicDrops,
            refinementAnalysis: relicAnalysis.refinementAnalysis
          };
        } else {
          updatedItem = basicItem;
        }
      } else {
        // For prime parts, just fetch basic price data
        updatedItem = await fetchSinglePriceOnly(item);
      }

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
    setShouldStopProcessing(false); // Reset stop flag

    // Set all items in category to loading state first
    setCategorizedInventory(prev => ({
      ...prev,
      [category]: prev[category].map(item => ({ ...item, status: 'loading' as const }))
    }));

    try {
      const updatedItems: InventoryItem[] = [];

      // Process items one by one to provide progress feedback
      for (let i = 0; i < items.length; i++) {
        // Check if processing was stopped
        if (shouldStopProcessing) {
          console.log(`>>> [HomePage] Category refresh stopped by user at item ${i+1}/${items.length} <<<`);
          break;
        }

        const item = items[i];
        console.log(`>>> [HomePage] Category refresh processing ${i + 1}/${items.length}: ${item.name} <<<`);

        try {
          let updatedItem: DetectedItem;

          if (category === 'relics') {
            // For relics, fetch basic price data AND calculate relic value analysis
            const basicItem = await fetchSinglePriceOnly(item);

            // Calculate relic value analysis using the actual detected rarity and market price
            const relicItem = item as VoidRelic;
            const relicAnalysis = await calculateRelicValueAnalysis(
              item.name,
              relicItem.rarity || 'intact',
              basicItem.price || 0
            );

            if (relicAnalysis) {
              updatedItem = {
                ...basicItem,
                category: 'relics' as const,
                quantity: relicItem.quantity, // ✅ Preserve original quantity
                minDropValue: relicAnalysis.minDropValue,
                maxDropValue: relicAnalysis.maxDropValue,
                expectedDropValue: relicAnalysis.expectedDropValue,
                recommendation: relicAnalysis.recommendation,
                expectedProfit: relicAnalysis.expectedProfit,
                directSalePrice: relicAnalysis.directSalePrice,
                relicDrops: relicAnalysis.relicDrops,
                refinementAnalysis: relicAnalysis.refinementAnalysis
              };
            } else {
              updatedItem = basicItem;
            }
          } else {
            // For prime parts, just fetch basic price data
            updatedItem = await fetchSinglePriceOnly(item);
          }

          updatedItems.push({
            ...updatedItem,
            addedAt: item.addedAt,
            lastUpdated: new Date(Date.now())
          });
          console.log(`>>> [HomePage] Category refresh updated: ${updatedItem.name}, status: ${updatedItem.status}, price: ${updatedItem.price} <<<`);
        } catch (error) {
          console.error(`Failed to fetch price for ${item.name}:`, error);
          updatedItems.push({
            ...item,
            status: 'error',
            error: 'Failed to fetch price',
            lastUpdated: new Date(Date.now())
          });
        }

        // Update progress less frequently to reduce flickering (every 3 items or at the end)
        if (i % 3 === 0 || i === items.length - 1) {
          setCategoryProgress({ category, current: i + 1, total: items.length });
        }
      }

      // Update persistent inventory with processed items
      if (updatedItems.length > 0) {
        updateInventoryPrices(updatedItems);

        // Update local state with all processed items at once (prevents flickering)
        setCategorizedInventory(prev => ({
          ...prev,
          [category]: prev[category].map(inventoryItem => {
            const updatedItem = updatedItems.find(updated => updated.name === inventoryItem.name);
            return updatedItem ? { ...inventoryItem, ...updatedItem, addedAt: inventoryItem.addedAt } : inventoryItem;
          })
        }));
      }

      setLastPriceRefresh(new Date());

      // Set category-specific last refresh time
      setLastRefreshTime(category);
      if (category === 'prime_parts') {
        setLastPrimePartsRefresh(new Date());
      } else if (category === 'relics') {
        setLastRelicsRefresh(new Date());
      }

      console.log(`>>> [HomePage] Category refresh completed for ${updatedItems.length} items <<<`);
    } catch (error) {
      console.error(`Error refreshing ${category} prices:`, error);

      // Reload from persistent storage on error to prevent empty inventory
      const updatedInventory = getCategorizedInventory();
      setCategorizedInventory(updatedInventory);
    } finally {
      setRefreshingCategories(prev => {
        const updated = new Set(prev);
        updated.delete(category);
        return updated;
      });
      setCategoryProgress(undefined);
    }
  }, [categorizedInventory, refreshingCategories, shouldStopProcessing]);

  // Refresh only sellable (Blueprint) prime parts in the Prime Parts section
  const handleRefreshSellablePrimeParts = useCallback(async () => {
    const items = sellablePrimeParts;
    if (items.length === 0 || refreshingCategories.has('prime_parts')) {
      return;
    }

    setRefreshingCategories(prev => new Set(prev).add('prime_parts'));
    setCategoryProgress({ category: 'prime_parts', current: 0, total: items.length });
    setShouldStopProcessing(false);

    try {
      const updatedItems: InventoryItem[] = [];

      // Mark only sellable items as loading
      const targetNames = new Set(items.map(i => i.name));
      setCategorizedInventory(prev => ({
        ...prev,
        prime_parts: prev.prime_parts.map(item => targetNames.has(item.name) ? { ...item, status: 'loading' as const } : item)
      }));

      for (let i = 0; i < items.length; i++) {
        if (shouldStopProcessing) {
          break;
        }
        const item = items[i];
        try {
          const updatedItem = await fetchSinglePriceOnly(item);
          updatedItems.push({
            ...updatedItem,
            addedAt: item.addedAt,
            lastUpdated: new Date(Date.now())
          });
        } catch (error) {
          updatedItems.push({
            ...item,
            status: 'error',
            error: 'Failed to fetch price',
            lastUpdated: new Date(Date.now())
          });
        }
        if (i % 3 === 0 || i === items.length - 1) {
          setCategoryProgress({ category: 'prime_parts', current: i + 1, total: items.length });
        }
      }

      if (updatedItems.length > 0) {
        updateInventoryPrices(updatedItems);
        setCategorizedInventory(prev => ({
          ...prev,
          prime_parts: prev.prime_parts.map(inventoryItem => {
            const updated = updatedItems.find(u => u.name === inventoryItem.name);
            return updated ? { ...inventoryItem, ...updated, addedAt: inventoryItem.addedAt } : inventoryItem;
          })
        }));
      }

      setLastPriceRefresh(new Date());
      setLastRefreshTime('prime_parts');
      setLastPrimePartsRefresh(new Date());
    } catch (error) {
      // Reload from storage on error
      const updatedInventory = getCategorizedInventory();
      setCategorizedInventory(updatedInventory);
    } finally {
      setRefreshingCategories(prev => {
        const updated = new Set(prev);
        updated.delete('prime_parts');
        return updated;
      });
      setCategoryProgress(undefined);
    }
  }, [sellablePrimeParts, refreshingCategories, shouldStopProcessing]);

  // Refresh all market prices (including syndicate rewards)
  const handleRefreshPrices = useCallback(async () => {
    console.log('>>> [HomePage] Starting bulk price refresh <<<');

    const allItems = [...categorizedInventory.prime_parts, ...categorizedInventory.relics];

    if (allItems.length === 0) {
      console.log('>>> [HomePage] No items to refresh <<<');
      return;
    }

    console.log(`>>> [HomePage] Found ${allItems.length} items to refresh <<<`);
    setFetchingProgress({ current: 0, total: allItems.length });
    setIsRefreshingPrices(true);
    setShouldStopProcessing(false); // Reset stop flag

    // Set all items to loading state first
    setCategorizedInventory(prev => ({
      prime_parts: prev.prime_parts.map(item => ({ ...item, status: 'loading' as const })),
      relics: prev.relics.map(item => ({ ...item, status: 'loading' as const }))
    }));

    try {
      const updatedItems: InventoryItem[] = [];

      for (let i = 0; i < allItems.length; i++) {
        // Check if processing was stopped
        if (shouldStopProcessing) {
          console.log(`>>> [HomePage] Bulk refresh stopped by user at item ${i+1}/${allItems.length} <<<`);
          break;
        }

        const item = allItems[i];
        console.log(`>>> [HomePage] Bulk refresh processing ${i + 1}/${allItems.length}: ${item.name} <<<`);

        try {
          let updatedItem: DetectedItem;

          if (item.category === 'relics') {
            // For relics, fetch basic price data AND calculate relic value analysis
            const basicItem = await fetchSinglePriceOnly(item);

            // Calculate relic value analysis using the actual detected rarity and market price
            const relicItem = item as VoidRelic;
            const relicAnalysis = await calculateRelicValueAnalysis(
              item.name,
              relicItem.rarity || 'intact',
              basicItem.price || 0
            );

            if (relicAnalysis) {
              updatedItem = {
                ...basicItem,
                category: 'relics' as const,
                quantity: relicItem.quantity, // ✅ Preserve original quantity
                minDropValue: relicAnalysis.minDropValue,
                maxDropValue: relicAnalysis.maxDropValue,
                expectedDropValue: relicAnalysis.expectedDropValue,
                recommendation: relicAnalysis.recommendation,
                expectedProfit: relicAnalysis.expectedProfit,
                directSalePrice: relicAnalysis.directSalePrice,
                relicDrops: relicAnalysis.relicDrops,
                refinementAnalysis: relicAnalysis.refinementAnalysis
              };
            } else {
              updatedItem = basicItem;
            }
          } else {
            // For prime parts, just fetch basic price data
            updatedItem = await fetchSinglePriceOnly(item);
          }

          updatedItems.push({
            ...updatedItem,
            addedAt: item.addedAt,
            lastUpdated: new Date(Date.now())
          });
          console.log(`>>> [HomePage] Bulk refresh updated: ${updatedItem.name}, status: ${updatedItem.status}, price: ${updatedItem.price} <<<`);
        } catch (error) {
          console.error(`Failed to fetch price for ${item.name}:`, error);
          updatedItems.push({
            ...item,
            status: 'error',
            error: 'Failed to fetch price',
            lastUpdated: new Date(Date.now())
          });
        }

        // Update progress less frequently to reduce flickering (every 5 items or at the end)
        if (i % 5 === 0 || i === allItems.length - 1) {
          setFetchingProgress({ current: i + 1, total: allItems.length });
        }
      }

      // Update persistent storage with processed items
      if (updatedItems.length > 0) {
        updateInventoryPrices(updatedItems);

        // Update state with all fetched items
        const primeUpdatedItems = updatedItems.filter(item => item.category === 'prime_parts');
        const relicUpdatedItems = updatedItems.filter(item => item.category === 'relics');

        setCategorizedInventory({
          prime_parts: primeUpdatedItems,
          relics: relicUpdatedItems
        });
      }
      console.log(`>>> [HomePage] Bulk refresh completed for ${updatedItems.length} items <<<`);
    } catch (error) {
      console.error('Failed to refresh prices:', error);
    } finally {
      setIsRefreshingPrices(false);
      setFetchingProgress({ current: 0, total: 0 });
    }

    // Also refresh syndicate rewards during bulk refresh
    if (!shouldStopProcessing) {
      console.log('>>> [HomePage] Including syndicate rewards in bulk refresh <<<');
      await handleRefreshSyndicateRewards();
    }
  }, [categorizedInventory, shouldStopProcessing, handleRefreshSyndicateRewards]);

  const inventoryStats = useMemo(() => getInventoryStats(), [categorizedInventory]);

  return (
    <main className="min-h-screen bg-background-dark">
      <div className="max-w-full mx-auto">
        {/* Full width layout */}
        <div className="space-y-3 p-3 lg:p-4">
          {/* Upload section - only show when not processing and no results, or when API key missing */}
          {(!isConfigured || (!activeImage && processingState.images.size === 0 && categorizedInventory.prime_parts.length === 0 && categorizedInventory.relics.length === 0)) && (
            <div className="bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-700/50 p-4 text-center">
              {isConfigured ? (
                <>
                  <h2 className="text-lg font-semibold mb-4">Ready to Scan</h2>
                  <p className="text-gray-400 text-sm mb-4">
                    Upload screenshots of your Warframe inventory to begin scanning for Prime parts and Void relics.
                  </p>
                  <ImageUploader
                    onImageUpload={handleImageUpload}
                    isProcessing={isProcessing}
                    images={processingState.images}
                    activeImageId={processingState.activeImageId}
                    onImageSelect={id => setProcessingState(prev => ({ ...prev, activeImageId: id }))}
                    onImageRemove={handleImageRemove}
                  />
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

          {/* Upload section - show at top when we have results but not processing */}
          {isConfigured && !isProcessing && (categorizedInventory.prime_parts.length > 0 || categorizedInventory.relics.length > 0 || categorizedInventory.syndicate_rewards.length > 0) && (
            <div className="bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-700/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Add More Screenshots</h3>
                <span className="text-xs text-gray-500">Drag and drop to add more items</span>
              </div>
              <ImageUploader
                onImageUpload={handleImageUpload}
                isProcessing={isProcessing}
                images={processingState.images}
                activeImageId={processingState.activeImageId}
                onImageSelect={id => setProcessingState(prev => ({ ...prev, activeImageId: id }))}
                onImageRemove={handleImageRemove}
              />
            </div>
          )}

          {isProcessing && (
            <div className="bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-700/50 p-4">
              <ProcessingAnimation
                stage={
                  activeImage?.status === 'analyzing' ? 'analyzing' :
                  activeImage?.status === 'analyzed' ? 'analyzed' :
                  activeImage?.status === 'fetching' ? 'fetching' :
                  'analyzing'
                }
                progress={activeImage?.status === 'fetching' ? fetchingProgress : undefined}
                onStop={stopProcessing}
                canStop={activeImage?.status === 'fetching'}
              />
            </div>
          )}

          {/* Story #8: Categorized Inventory Sections */}
          {(categorizedInventory.prime_parts.length > 0 || categorizedInventory.relics.length > 0 || categorizedInventory.syndicate_rewards.length > 0) && (
            <div className="space-y-2">

              {/* Prime Parts Section */}
              <InventorySection
                category="prime_parts"
                title="Prime Parts"
                icon={<Package size={20} className="text-orokin-gold" />}
                items={sellablePrimeParts}
                totalValue={sellablePrimePartsTotals.value}
                totalDucats={sellablePrimePartsTotals.ducats}
                isRefreshing={refreshingCategories.has('prime_parts')}
                progress={categoryProgress?.category === 'prime_parts' ? categoryProgress : undefined}
                lastRefreshTime={lastPrimePartsRefresh}
                onRefreshAll={handleRefreshSellablePrimeParts}
                onClearAll={handleClearSellablePrimeParts}
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
                lastRefreshTime={lastRelicsRefresh}
                onRefreshAll={() => handleRefreshCategoryPrices('relics')}
                onClearAll={() => handleClearInventory('relics')}
                onRefreshItem={handleRefreshSingleItem}
                onRemoveItem={handleRemoveFromInventory}
              />

              {/* Prime Sets Section - Show when we have prime parts OR existing prime sets cache */}
              {(categorizedInventory.prime_parts.length > 0 || getPrimeSetsCache().length > 0) && (
                <PrimeSetsSection
                  primePartsInventory={categorizedInventory.prime_parts}
                  relicsInventory={categorizedInventory.relics as VoidRelic[]}
                />
              )}
            </div>
          )}

          {/* Syndicate Rewards Section - Always show for market analysis */}
          <SyndicateRewardsSection
            isRefreshing={isRefreshingSyndicateRewards}
            onRefreshStart={handleRefreshSyndicateRewards}
            onRefreshComplete={() => setIsRefreshingSyndicateRewards(false)}
            recommendations={syndicateRecommendations}
            onClearRecommendations={() => setSyndicateRecommendations([])}
          />

          {/* Empty state - only show when no processing and no results */}
          {!isProcessing && categorizedInventory.prime_parts.length === 0 && categorizedInventory.relics.length === 0 && processingState.images.size === 0 && (
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
    </main>
  );
};

export default HomePage;