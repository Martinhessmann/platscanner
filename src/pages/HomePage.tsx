import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import ImageUploader from '../components/ImageUploader';
import ProcessingPanel from '../components/ProcessingPanel';
import InventorySection from '../components/InventorySection';
import SyndicateRewardsSection from '../components/SyndicateRewardsSection';
import ModDuplicatesSection from '../components/ModDuplicatesSection';
import { analyzeImage, isGeminiConfigured } from '../services/ocrService';
import { fetchSinglePriceData, fetchSinglePriceOnly } from '../services/warframeMarketService';
import { isPrimePartTradeable } from '../services/primeSetService';
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
  updateInventoryWithStaticDucats
} from '../services/inventoryService';
import { getPrimeSetsCache, setPrimeSetsCache, analyzeSetProgress } from '../services/primeSetService';
import { ImageState, DetectedItem, ProcessingState, VoidRelic, InventoryItem, Mod, PrimeSetItem } from '../types';
import type { SetProgress } from '../services/primeSetService';
import InfoCard from '../components/InfoCard';
import PrimeSetsSection from '../components/PrimeSetsSection';
import { FileWithPath } from 'react-dropzone';
import { Package, Zap, Key } from 'lucide-react';

interface HomePageProps {
  isConfigured: boolean;
  onOpenSettings: () => void;
  refreshTrigger?: number;
}

interface ProcessingMetadata {
  duplicatesPerImage: Map<string, number>;
  currentFetchItem?: { name: string; index: number; total: number };
}

const HomePage: React.FC<HomePageProps> = ({ isConfigured, onOpenSettings, refreshTrigger }) => {
  const [processingState, setProcessingState] = useState<ProcessingState>({
    activeImageId: null,
    images: new Map(),
    combinedResults: new Map(), // Keep for compatibility, but won't be used
    processedCount: 0,
    totalCount: 0
  });

  const [processingMetadata, setProcessingMetadata] = useState<ProcessingMetadata>({
    duplicatesPerImage: new Map(),
    currentFetchItem: undefined
  });

  const [lastPrimePartsRefresh, setLastPrimePartsRefresh] = useState<Date | null>(null);
  const [lastRelicsRefresh, setLastRelicsRefresh] = useState<Date | null>(null);
  const [lastModRefresh, setLastModRefresh] = useState<Date | null>(null);
  const [lastSyndicateRewardsRefresh, setLastSyndicateRewardsRefresh] = useState<Date | null>(null);
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);
  const [isRefreshingSyndicateRewards, setIsRefreshingSyndicateRewards] = useState(false);
  const [isRefreshingMods, setIsRefreshingMods] = useState(false);
  const cancelSyndicateRefreshRef = useRef(false);
  const [refreshingCategories, setRefreshingCategories] = useState<Set<string>>(new Set());
  const [fetchingProgress, setFetchingProgress] = useState<{ current: number; total: number } | undefined>(undefined);
  const [categoryProgress, setCategoryProgress] = useState<{ category: string; current: number; total: number } | undefined>(undefined);
  const [shouldStopProcessing, setShouldStopProcessing] = useState(false);
  const [inventoryRefreshTrigger, setInventoryRefreshTrigger] = useState(0);

  // Story #3 & #8: Categorized Persistent Inventory State
  const [categorizedInventory, setCategorizedInventory] = useState({
    prime_parts: [] as InventoryItem[],
    relics: [] as InventoryItem[],
    syndicate_rewards: [] as InventoryItem[],
    mods: [] as InventoryItem[]
  });

  // State for Prime Sets data (same as PrimeSetsSection)
  const [primeSetsData, setPrimeSetsData] = useState<SetProgress[]>([]);

  // Load Prime Sets data from inventory-backed cache; if empty, analyze and populate
  useEffect(() => {
    const loadPrimeSetsData = async () => {
      try {
        // Prefer existing inventory-backed cache
        let progress = getPrimeSetsCache();
        if (!progress || progress.length === 0) {
          const analyzed = await analyzeSetProgress(categorizedInventory.prime_parts as any, categorizedInventory.relics as any);
          setPrimeSetsCache(analyzed);
          progress = analyzed;
        }

        // Filter to incomplete sets only (same logic as PrimeSetsSection "planner" filter)
        const incompleteSets = progress
          .filter(setProgress => {
            const isIncomplete = !setProgress.ismastered && setProgress.ownedParts.length > 0;
            return isIncomplete;
          })
          .sort((a, b) => b.completionPercentage - a.completionPercentage);
        setPrimeSetsData(incompleteSets);
      } catch (error) {
        console.error('>>> [Prime Sets Data] Error:', error);
        setPrimeSetsData([]);
      }
    };

    if (categorizedInventory.prime_parts.length > 0) {
      loadPrimeSetsData();
    } else {
      setPrimeSetsData([]);
    }
  }, [categorizedInventory.prime_parts, categorizedInventory.relics]);

  // Prime parts to display based on filter
  const displayedPrimeParts = useMemo(() => {
    const validParts = categorizedInventory.prime_parts.filter(item => {
      // Filter out corrupted Gemini data
      if (item.category !== 'prime_parts') return false;
      const lowerName = item.name.toLowerCase();
      if (lowerName.includes('here are the') ||
          lowerName.includes('visible in the screenshot') ||
          lowerName.includes('items detected') ||
          lowerName.length < 5) return false;
      return true;
    });
    return validParts;
  }, [categorizedInventory.prime_parts, primeSetsData]);

  // Totals for displayed parts
  const displayedPrimePartsTotals = useMemo(() => {
    const value = displayedPrimeParts.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);
    const ducats = displayedPrimeParts.reduce((sum, item) => sum + ((item.ducats || 0) * (item.quantity || 1)), 0);
    return { value, ducats };
  }, [displayedPrimeParts]);

  // Handle syndicate rewards refresh - define early for use in useEffect
  const handleRefreshSyndicateRewards = useCallback(async (itemsToRefresh?: InventoryItem[]) => {
    if (isRefreshingSyndicateRewards) {
      console.log('>>> [HomePage] Syndicate refresh already in progress, skipping <<<');
      return;
    }

    console.log('>>> [HomePage] Starting syndicate rewards refresh <<<');
    setIsRefreshingSyndicateRewards(true);
    cancelSyndicateRefreshRef.current = false;

    try {
      const { getAllSyndicateRewards, fetchSyndicateRewardPrices } = await import('../services/syndicateService');
      // Use provided filtered items, or fall back to all items
      const rewardsToRefresh = itemsToRefresh && itemsToRefresh.length > 0
        ? itemsToRefresh as any
        : getAllSyndicateRewards();

      if (rewardsToRefresh.length === 0) {
        console.log('>>> [HomePage] No syndicate rewards to refresh <<<');
        return;
      }

      console.log(`>>> [HomePage] Found ${rewardsToRefresh.length} syndicate rewards to refresh ${itemsToRefresh ? '(filtered)' : '(all)'} <<<`);
      const updatedRewards = await fetchSyndicateRewardPrices(
        rewardsToRefresh,
        () => cancelSyndicateRefreshRef.current
      );

      // Update syndicate rewards in inventory only if not cancelled
      if (updatedRewards.length > 0 && !cancelSyndicateRefreshRef.current) {
        const { updateInventoryPrices } = await import('../services/inventoryService');
        updateInventoryPrices(updatedRewards);

        // Refresh local inventory state
        const inventory = getCategorizedInventory();
        setCategorizedInventory(inventory);
        setInventoryRefreshTrigger(prev => prev + 1);
      } else if (cancelSyndicateRefreshRef.current) {
        console.log('>>> [HomePage] Skipping inventory update due to cancellation <<<');
      }
      setLastSyndicateRewardsRefresh(new Date());
      console.log(`>>> [HomePage] Syndicate rewards refresh completed for ${updatedRewards.length} items <<<`);
    } catch (error) {
      console.error('Failed to refresh syndicate rewards:', error);
    } finally {
      setIsRefreshingSyndicateRewards(false);
      cancelSyndicateRefreshRef.current = false;
    }
  }, [isRefreshingSyndicateRewards]);

  // Handle syndicate rewards cancellation
  const handleCancelSyndicateRefresh = useCallback(() => {
    console.log('>>> [HomePage] Cancelling syndicate rewards refresh <<<');
    cancelSyndicateRefreshRef.current = true;
  }, []);

  // Handle mod duplicates refresh
  const handleRefreshMods = useCallback(async (itemsToRefresh?: InventoryItem[]) => {
    if (isRefreshingMods) {
      console.log('>>> [HomePage] Mod refresh already in progress, skipping <<<');
      return;
    }

    console.log('>>> [HomePage] Starting mod refresh <<<');
    setIsRefreshingMods(true);
    setCategoryProgress({ category: 'mods', current: 0, total: 0 });

    try {
      const inventory = getCategorizedInventory();
      // Use provided items or fall back to all mods
      const modItems = itemsToRefresh || inventory.mods;

      if (modItems.length === 0) {
        console.log('>>> [HomePage] No mods to refresh <<<');
        return;
      }

      console.log(`>>> [HomePage] Found ${modItems.length} mods to refresh ${itemsToRefresh ? '(filtered)' : '(all)'} <<<`);

      // Import and use mod service to refresh prices
      const { refreshModPrices } = await import('../services/modService');
      const modData = modItems.map(item => ({
        ...item,
        rarity: (item as any).rarity || 'uncommon',
        type: (item as any).type || 'other',
        addedAt: item.addedAt instanceof Date ? item.addedAt : new Date(item.addedAt),
        lastUpdated: item.lastUpdated instanceof Date ? item.lastUpdated : new Date(item.lastUpdated)
      }));

      const updatedMods = await refreshModPrices(
        modData,
        (current, total) => {
          setCategoryProgress({ category: 'mods', current, total });
        }
      );

      // Update inventory with refreshed mod prices
      if (updatedMods.length > 0) {
        const { updateInventoryPrices } = await import('../services/inventoryService');
        updateInventoryPrices(updatedMods as any);

        // Refresh local inventory state
        const newInventory = getCategorizedInventory();
        setCategorizedInventory(newInventory);
        setInventoryRefreshTrigger(prev => prev + 1);
      }

      setLastModRefresh(new Date());
      console.log(`>>> [HomePage] Mod refresh completed for ${updatedMods.length} items <<<`);
    } catch (error) {
      console.error('Failed to refresh mods:', error);
    } finally {
      setIsRefreshingMods(false);
      setCategoryProgress(undefined);
    }
  }, [isRefreshingMods]);

  // Handle individual syndicate reward refresh
  const handleRefreshSingleSyndicateReward = useCallback(async (itemName: string) => {
    console.log(`>>> [HomePage] Refreshing single syndicate reward: ${itemName} <<<`);

    try {
      const { getAllSyndicateRewards, fetchSyndicateRewardPrices } = await import('../services/syndicateService');
      const allSyndicateRewards = getAllSyndicateRewards();
      const item = allSyndicateRewards.find(r => r.name === itemName);

      if (!item) {
        console.log(`>>> [HomePage] Syndicate reward not found: ${itemName} <<<`);
        return;
      }

      const updatedRewards = await fetchSyndicateRewardPrices([item]);

      if (updatedRewards.length > 0) {
        const { updateInventoryPrices } = await import('../services/inventoryService');
        updateInventoryPrices(updatedRewards);

        // Refresh local inventory state
        const inventory = getCategorizedInventory();
        setCategorizedInventory(inventory);
        setInventoryRefreshTrigger(prev => prev + 1);
      }
    } catch (error) {
      console.error(`Failed to refresh syndicate reward ${itemName}:`, error);
    }
  }, []);

  // Load persistent inventory on component mount
  useEffect(() => {
    // Update existing inventory items with static ducat values
    updateInventoryWithStaticDucats();

    const inventory = getCategorizedInventory();
    setCategorizedInventory(inventory);
    setInventoryRefreshTrigger(prev => prev + 1);

    // Load last refresh times
    setLastPrimePartsRefresh(getLastRefreshTime('prime_parts'));
    setLastRelicsRefresh(getLastRefreshTime('relics'));
  }, []);

  // Note: Auto-fetch disabled - users should manually refresh prices when needed
  // useEffect(() => {
  //   if (isConfigured && !isRefreshingSyndicateRewards && categorizedInventory.syndicate_rewards.length > 0) {
  //     console.log('>>> [HomePage] Auto-fetching syndicate rewards on app load <<<');
  //     handleRefreshSyndicateRewards();
  //   }
  // }, [isConfigured, categorizedInventory.syndicate_rewards.length]);

  // Refresh inventory when data is imported
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      const inventory = getCategorizedInventory();
      setCategorizedInventory(inventory);
      setInventoryRefreshTrigger(prev => prev + 1);
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

  // Separate processing for AI analysis
  const processImageAnalysis = useCallback(async (imageId: string) => {
  // 1. Update status to analyzing
    setProcessingState(prev => {
      const newImages = new Map(prev.images);
      const img = newImages.get(imageId);
      if (img) {
        newImages.set(imageId, { ...img, status: 'analyzing' });
      }
      return { ...prev, activeImageId: imageId, images: newImages };
    });

    // 2. Perform Async Analysis
    try {
      // Get the image file
      const imageState = processingState.images.get(imageId);
      if (!imageState) return;

      console.log(`>>> [AI Analysis] Starting analysis for image: ${imageId} <<<`);
      const startTime = Date.now();

      // Extract items using Gemini AI
      const analysisResult = await analyzeImage(imageState.file);
      const detectedItems = analysisResult.items || [];
      const screenType = analysisResult.screenType || 'unknown';

      // Check if processing was stopped
      if (shouldStopProcessing) {
        setProcessingState(current => ({
          ...current,
          images: new Map(current.images).set(imageId, {
            ...imageState,
            status: 'complete',
            error: 'Processing stopped by user',
            results: [],
            screenType: screenType as any,
            wasCached: false
          }),
          processedCount: current.processedCount + 1
        }));
        return;
      }

      // Filter out items already in inventory
      const currentInventory = loadInventory();
      const existingItemNames = new Set(currentInventory.items.map(item => item.name));
      const newItems = Array.isArray(detectedItems) ? detectedItems.filter(item => !existingItemNames.has(item.name)) : [];
      const duplicatesCount = Array.isArray(detectedItems) ? detectedItems.length - newItems.length : 0;

      console.log(`>>> [AI Analysis] Detected ${Array.isArray(detectedItems) ? detectedItems.length : 0} items, ${newItems.length} are new, ${duplicatesCount} duplicates <<<`);

      setProcessingMetadata(current => ({
        ...current,
        duplicatesPerImage: new Map(current.duplicatesPerImage).set(imageId, duplicatesCount)
      }));

      const wasCached = (Date.now() - startTime) < 500;

      if (newItems.length === 0) {
        setProcessingState(current => ({
          ...current,
          images: new Map(current.images).set(imageId, {
            ...imageState,
            status: 'complete',
            results: [],
            screenType: screenType as any,
            wasCached
          }),
          processedCount: current.processedCount + 1
        }));
        return;
      }

      // Update success state
      setProcessingState(current => ({
        ...current,
        images: new Map(current.images).set(imageId, {
          ...imageState,
          status: 'analyzed',
          results: newItems,
          syndicateRewards: newItems.filter(item => item.category === 'syndicate_rewards'),
          screenType: screenType as any,
          wasCached
        })
      }));

      console.log(`>>> [AI Analysis] Completed for image: ${imageId}, queued for price fetching <<<`);

    } catch (error) {
      console.error('>>> [AI Analysis] Error:', error);
      setProcessingState(errorState => {
        const failedImg = errorState.images.get(imageId);
        return {
          ...errorState,
          images: new Map(errorState.images).set(imageId, {
            ...failedImg!,
            status: 'error',
            error: error instanceof Error ? error.message : 'AI analysis failed'
          }),
          processedCount: errorState.processedCount + 1
        };
      });
    }
  }, [shouldStopProcessing, processingState.images]);

  // Separate processing for price fetching
  const processPriceFetching = useCallback(async (imageId: string) => {
  // 1. Update status to fetching
    setProcessingState(prev => {
      const newImages = new Map(prev.images);
      const img = newImages.get(imageId);
      if (img) {
        newImages.set(imageId, { ...img, status: 'fetching' });
      }
      return { ...prev, images: newImages };
    });

    // 2. Perform Async Fetching
    try {
      let imageState: ImageState | undefined;
      setProcessingState(prev => {
        imageState = prev.images.get(imageId);
        return prev;
      });

      if (!imageState || !imageState.results) return;

      const newItems = imageState.results;
      const hasSyndicateRewards = imageState.syndicateRewards && imageState.syndicateRewards.length > 0;

      if (newItems.length === 0) {
        setProcessingState(current => {
          const img = current.images.get(imageId);
          if (!img) return current;
          const newImages = new Map(current.images);
          newImages.set(imageId, { ...img, status: 'complete' });
          return {
            ...current,
            images: newImages,
            processedCount: current.processedCount + 1
          };
        });
        return;
      }

      console.log(`>>> [Price Fetching] Starting price fetch for ${newItems.length} items from image: ${imageId} <<<`);
      setFetchingProgress({ current: 0, total: newItems.length });

      const sessionId = `scan_${Date.now()}`;
      const processedItems: DetectedItem[] = [];

      for (let index = 0; index < newItems.length; index++) {
        const item = newItems[index];

        if (shouldStopProcessing) {
          setProcessingState(current => {
            const img = current.images.get(imageId);
            if (!img) return current;
            const newImages = new Map(current.images);
            newImages.set(imageId, {
              ...img,
              status: 'complete',
              error: 'Processing stopped by user',
              results: processedItems
            });
            return {
              ...current,
              images: newImages,
              processedCount: current.processedCount + 1
            };
          });

          if (processedItems.length > 0) {
            saveToInventory(processedItems as any[], sessionId);
            const updatedInventory = getCategorizedInventory();
            setCategorizedInventory(updatedInventory as any);
            setInventoryRefreshTrigger(prev => prev + 1);
          }
          return;
        }

        console.log(`>>> [Price Fetching] Processing item ${index + 1}/${newItems.length}: ${item.name} <<<`);

        // Skip price fetching for built warframe parts (non-tradeable)
        if (item.category === 'prime_parts' && !isPrimePartTradeable(item.name)) {
          const nonTradeableItem: DetectedItem = {
            ...item,
            price: 0,
            status: 'loaded',
            error: undefined
          };
          saveToInventory([nonTradeableItem as any], sessionId);
          const updatedInventory = getCategorizedInventory();
          setCategorizedInventory(updatedInventory as any);
          setInventoryRefreshTrigger(prev => prev + 1);
          continue;
        }

        setProcessingMetadata(current => ({
          ...current,
          currentFetchItem: { name: item.name, index: index + 1, total: newItems.length }
        }));

        try {
          let processedItem: DetectedItem;

          if (item.category === 'relics') {
            const priceData = await fetchSinglePriceData(item);
            if (priceData) {
              const relicItem = item as VoidRelic;
              const relicAnalysis = await calculateRelicValueAnalysis(
                item.name,
                relicItem.rarity as any || 'intact',
                priceData.price || 0
              );

              if (relicAnalysis) {
                processedItem = {
                  ...item,
                  price: priceData.price,
                  average: priceData.average,
                  volume: priceData.volume,
                  status: 'loaded',
                  ...relicAnalysis
                } as VoidRelic;
              } else {
                processedItem = {
                  ...item,
                  price: priceData.price,
                  average: priceData.average,
                  volume: priceData.volume,
                  status: 'loaded'
                } as VoidRelic;
              }
            } else {
              processedItem = { ...item, price: 0, status: 'error' } as VoidRelic;
            }
          } else if (item.category === 'mods') {
            const { calculateEndoValue, analyzeModForDuplicates } = await import('../services/modService');
            let priceData = null;
            try {
              priceData = await fetchSinglePriceData(item);
            } catch {
              // fallback
            }

            const modItem: Mod = {
              ...item,
              price: priceData?.price || 0,
              volume: priceData?.volume || 0,
              average: priceData?.average || 0,
              status: 'loaded',
              rarity: priceData?.rarity || (item as Mod).rarity || 'unknown',
              type: (item as Mod).type || 'other'
            } as Mod;

            const endoValue = calculateEndoValue(modItem as any);
            processedItem = analyzeModForDuplicates({ ...modItem, endoValue } as any) as any;
          } else {
            const priceData = await fetchSinglePriceData(item);
            processedItem = {
              ...item,
              price: priceData?.price || 0,
              average: priceData?.average || 0,
              volume: priceData?.volume || 0,
              status: 'loaded'
            } as DetectedItem;
          }

          processedItems.push(processedItem);
          saveToInventory([processedItem as any], sessionId);
          setFetchingProgress({ current: index + 1, total: newItems.length });

          const updatedInventory = getCategorizedInventory();
          setCategorizedInventory(updatedInventory as any);
          setInventoryRefreshTrigger(prev => prev + 1);

        } catch (error) {
          console.error(`>>> [Price Fetching] Error for ${item.name}:`, error);
          const errorItem = { ...item, status: 'error', error: 'Failed to fetch price' } as DetectedItem;
          processedItems.push(errorItem);
          saveToInventory([errorItem as any], sessionId);
          setFetchingProgress({ current: index + 1, total: newItems.length });
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Syndicate rewards
      if (hasSyndicateRewards && imageState.syndicateRewards) {
        try {
          const { fetchSyndicateRewardPrices } = await import('../services/syndicateService');
          const updatedRewards = await fetchSyndicateRewardPrices(imageState.syndicateRewards as any);
          if (updatedRewards.length > 0) {
            updateInventoryPrices(updatedRewards as any);
            const updatedInventory = getCategorizedInventory();
            setCategorizedInventory(updatedInventory as any);
            setInventoryRefreshTrigger(prev => prev + 1);
          }
        } catch (error) {
          console.error(`>>> [Price Fetching] Syndicate rewards error:`, error);
        }
      }

      setProcessingState(current => {
        const img = current.images.get(imageId);
        if (!img) return current;
        const newImages = new Map(current.images);
        newImages.set(imageId, { ...img, status: 'complete', results: processedItems });
        return { ...current, images: newImages, processedCount: current.processedCount + 1 };
      });

      setProcessingMetadata(current => ({ ...current, currentFetchItem: undefined }));

    } catch (error) {
      console.error('>>> [Price Fetching] Global Error:', error);
      setProcessingState(errorState => {
        const failedImg = errorState.images.get(imageId);
        if (!failedImg) return errorState;
        const newImages = new Map(errorState.images);
        newImages.set(imageId, { ...failedImg, status: 'error', error: 'Fetching failed' });
        return { ...errorState, images: newImages, processedCount: errorState.processedCount + 1 };
      });
    }
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
      console.log(`>>> [Parallel Processing] Starting AI analysis for image: ${queuedImages[0].id} <<<`);
      processImageAnalysis(queuedImages[0].id);
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
      console.log(`>>> [Parallel Processing] Starting price fetching for image: ${analyzedImages[0].id} <<<`);
      processPriceFetching(analyzedImages[0].id);
    }
  }, [processingState.images, processPriceFetching]);


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

    // Also clean up metadata for this image
    setProcessingMetadata(prev => {
      const newDuplicatesMap = new Map(prev.duplicatesPerImage);
      newDuplicatesMap.delete(id);
      return {
        ...prev,
        duplicatesPerImage: newDuplicatesMap
      };
    });
  }, []);

  // Retry a failed image: re-queue for analysis and clear cache
  const handleImageRetry = useCallback(async (id: string) => {
    const image = processingState.images.get(id);
    if (!image) return;

    // Clear the cache for this image to force a fresh analysis
    try {
      const { clearCachedAnalysis, generateImageHash, fileToBase64 } = await import('../services/ocrService');
      const imageBase64 = await fileToBase64(image.file);
      const imageHash = await generateImageHash(imageBase64);
      clearCachedAnalysis(imageHash);
      console.log(`>>> [Retry] Cleared cache for image: ${id} <<<`);
    } catch (error) {
      console.warn('Failed to clear cache for retry:', error);
    }

    setProcessingState(prev => {
      const newImages = new Map(prev.images);
      newImages.set(id, {
        ...image,
        status: 'queued',
        error: undefined,
        results: [],
        wasCached: false
      });

      return {
        ...prev,
        images: newImages,
        activeImageId: id,
        processedCount: Math.max(0, prev.processedCount - 1)
      };
    });
  }, [processingState.images]);

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
      relics: prev.relics.filter(item => item.name !== itemName),
      syndicate_rewards: prev.syndicate_rewards.filter(item => item.name !== itemName),
      mods: prev.mods.filter(item => item.name !== itemName)
    }));
  }, []);

  const handleClearInventory = useCallback((category: 'prime_parts' | 'relics' | 'syndicate_rewards' | 'mods') => {
    // Cancel syndicate refresh if we're clearing syndicate rewards
    if (category === 'syndicate_rewards' && isRefreshingSyndicateRewards) {
      console.log('>>> [HomePage] Cancelling syndicate refresh before clearing inventory <<<');
      cancelSyndicateRefreshRef.current = true;
    }

    clearInventoryByCategory(category);
    setCategorizedInventory(prev => ({
      ...prev,
      [category]: []
    }));

    // Trigger inventory refresh
    setInventoryRefreshTrigger(prev => prev + 1);
  }, [isRefreshingSyndicateRewards]);

  // Clear prime parts (all or blueprints only based on current view)
  const handleClearPrimeParts = useCallback(() => {
    const itemsToRemove = displayedPrimeParts;
    const namesToRemove = new Set(itemsToRemove.map(i => i.name));
    namesToRemove.forEach(name => removeFromInventory(name));

    // Clear only the currently displayed items (which is the full valid list)
    setCategorizedInventory(prev => ({
      ...prev,
      prime_parts: prev.prime_parts.filter(item => !namesToRemove.has(item.name))
    }));
  }, [categorizedInventory.prime_parts, displayedPrimeParts]);


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
            ...relicAnalysis,
            category: 'relics' as const,
            quantity: (item as any).quantity
          } as unknown as VoidRelic;
        } else {
          updatedItem = basicItem;
        }
      } else {
        // For prime parts, skip fetching if it's a built warframe part (non-tradeable)
        if (!isPrimePartTradeable(itemName)) {
          console.log(`>>> [HomePage] Skipping refresh for built warframe part (non-tradeable): ${itemName} <<<`);
          updatedItem = {
            ...item,
            price: 0,
            status: 'loaded' as const,
            error: undefined
          };
        } else {
          // For tradeable prime parts, fetch basic price data
          updatedItem = await fetchSinglePriceOnly(item);
        }
      }

      console.log(`>>> [HomePage] Fetched updated item: ${updatedItem.name}, status: ${updatedItem.status}, price: ${updatedItem.price} <<<`);

      // Update persistent storage
      updateInventoryPrices([updatedItem]);

      // Update local state - preserve addedAt and merge new data
      setCategorizedInventory(prev => ({
        ...prev,
        [category]: (prev[category] as any[]).map(inventoryItem =>
          inventoryItem.name === itemName
            ? { ...inventoryItem, ...updatedItem, addedAt: inventoryItem.addedAt }
            : inventoryItem
        )
      }) as any);

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
  }, [categorizedInventory, primeSetsData]);

  // Category-specific refresh handlers
  const handleRefreshCategoryPrices = useCallback(async (category: 'prime_parts' | 'relics', itemsToRefresh?: InventoryItem[]) => {
    const items = itemsToRefresh || categorizedInventory[category];
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

          // Skip fetching for built warframe parts (non-tradeable)
          if (category === 'prime_parts' && !isPrimePartTradeable(item.name)) {
            console.log(`>>> [HomePage] Category refresh skipping built warframe part (non-tradeable): ${item.name} <<<`);
            updatedItem = {
              ...item,
              price: 0,
              status: 'loaded' as const,
              error: undefined
            };
          } else if (category === 'relics') {
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
                ...relicAnalysis,
                category: 'relics' as const,
                quantity: (item as any).quantity
              } as VoidRelic;
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

  // Refresh displayed prime parts (all or blueprints based on toggle)
  const handleRefreshPrimeParts = useCallback(async (itemsToRefresh?: InventoryItem[]) => {
    const items = itemsToRefresh || displayedPrimeParts;
    if (items.length === 0 || refreshingCategories.has('prime_parts')) {
      return;
    }

    setRefreshingCategories(prev => new Set(prev).add('prime_parts'));
    setCategoryProgress({ category: 'prime_parts', current: 0, total: items.length });
    setShouldStopProcessing(false);

    try {
      const updatedItems: InventoryItem[] = [];

      // Refresh individual parts
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
        } catch {
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

      setLastRelicsRefresh(new Date());
      setLastRefreshTime('prime_parts');
      setLastPrimePartsRefresh(new Date());
    } catch {
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
  }, [displayedPrimeParts, refreshingCategories, shouldStopProcessing]);

  const inventoryStats = useMemo(() => getInventoryStats(), [categorizedInventory]);

  return (
    <main className="min-h-screen bg-background-dark">
      <div className="max-w-full mx-auto">
        {/* Full width layout */}
        <div className="space-y-3 p-3 lg:p-4">
          {/* Initial upload section - show when no inventory exists yet AND not processing */}
          {isConfigured && categorizedInventory.prime_parts.length === 0 && categorizedInventory.relics.length === 0 && categorizedInventory.syndicate_rewards.length === 0 && !isProcessing && (
            <div className="bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-700/50 p-4 text-center">
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
            </div>
          )}

          {/* Upload section during initial processing - show when no inventory but processing */}
          {isConfigured && categorizedInventory.prime_parts.length === 0 && categorizedInventory.relics.length === 0 && categorizedInventory.syndicate_rewards.length === 0 && isProcessing && (
            <div className="bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-700/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Processing Images</h3>
                <span className="text-xs text-gray-500">You can add more images while processing</span>
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

          {/* OCR Ready - No API Key Needed */}
          {!isConfigured && (
            <div className="bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-700/50 p-4 text-center">
              <Key size={40} className="mx-auto text-orokin-gold mb-3" />
              <h2 className="text-lg font-semibold mb-2">OCR Ready</h2>
              <p className="text-gray-400 mb-4 text-sm">
                OCR-based text extraction is ready. Upload screenshots to start scanning your inventory.
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
            </div>
          )}

          {/* Upload section - always show when configured and we have results */}
          {isConfigured && (categorizedInventory.prime_parts.length > 0 || categorizedInventory.relics.length > 0 || categorizedInventory.syndicate_rewards.length > 0) && (
            <div className="bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-700/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Add More Screenshots</h3>
                <span className="text-xs text-gray-500">
                  {isProcessing ? 'Processing in progress - you can still add more images' : 'Drag and drop to add more items'}
                </span>
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

          {/* Processing Panel - always show when we have images */}
          {processingState.images.size > 0 && (
            <div className="bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-700/50 p-4">
              <ProcessingPanel
                stage={
                  isProcessing ? (
                    activeImage?.status === 'analyzing' ? 'analyzing' :
                    activeImage?.status === 'analyzed' ? 'analyzed' :
                    activeImage?.status === 'fetching' ? 'fetching' :
                    'analyzing'
                  ) : 'complete'
                }
                progress={activeImage?.status === 'fetching' ? fetchingProgress : undefined}
                onStop={stopProcessing}
                canStop={activeImage?.status === 'fetching'}
                images={processingState.images}
                activeImageId={processingState.activeImageId}
                duplicatesPerImage={processingMetadata.duplicatesPerImage}
                currentFetchItem={processingMetadata.currentFetchItem}
                onImageRemove={handleImageRemove}
                onImageSelect={id => setProcessingState(prev => ({ ...prev, activeImageId: id }))}
                onImageRetry={handleImageRetry}
              />
            </div>
          )}

          {/* Story #8: Categorized Inventory Sections */}
          {/* Always show Prime Parts section (even when empty) so users can upload items */}
          <div className="space-y-2">
            {/* Prime Parts Section - Always visible */}
            <InventorySection
              category="prime_parts"
              title="Prime Parts"
              icon={<Package size={20} className="text-orokin-gold" />}
              items={displayedPrimeParts}
              totalValue={displayedPrimePartsTotals.value}
              totalDucats={displayedPrimePartsTotals.ducats}
              isRefreshing={refreshingCategories.has('prime_parts')}
              progress={categoryProgress?.category === 'prime_parts' ? categoryProgress : undefined}
              lastRefreshTime={lastPrimePartsRefresh}
              onRefreshAll={handleRefreshPrimeParts}
              onClearAll={handleClearPrimeParts}
              onRefreshItem={handleRefreshSingleItem}
              onRemoveItem={handleRemoveFromInventory}
            />

            {/* Void Relics Section - Only show when there are relics */}
            {categorizedInventory.relics.length > 0 && (
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
                onRefreshAll={(itemsToRefresh) => handleRefreshCategoryPrices('relics', itemsToRefresh)}
                onClearAll={() => handleClearInventory('relics')}
                onRefreshItem={handleRefreshSingleItem}
                onRemoveItem={handleRemoveFromInventory}
              />
            )}

            {/* Prime Sets Section - Always visible as a collection tracker */}
            <PrimeSetsSection
              primePartsInventory={categorizedInventory.prime_parts.filter(item =>
                // Only include valid prime parts - filter out corrupted/fake data
                item.category === 'prime_parts' &&
                item.name &&
                item.name.length > 5 &&
                !item.name.toLowerCase().includes('here are the') &&
                !item.name.toLowerCase().includes('visible in the screenshot') &&
                !item.name.toLowerCase().includes('items detected')
              )}
              relicsInventory={categorizedInventory.relics as VoidRelic[]}
            />
          </div>

          {/* Syndicate Rewards Section - Always show for market analysis */}
          <SyndicateRewardsSection
            isRefreshing={isRefreshingSyndicateRewards}
            onRefreshStart={handleRefreshSyndicateRewards as any}
            onRefreshComplete={() => setIsRefreshingSyndicateRewards(false)}
            onCancel={handleCancelSyndicateRefresh}
            onClearAll={() => handleClearInventory('syndicate_rewards')}
            onRemoveItem={handleRemoveFromInventory}
            onRefreshItem={handleRefreshSingleSyndicateReward}
            refreshTrigger={inventoryRefreshTrigger}
            lastRefreshTime={lastSyndicateRewardsRefresh}
          />

          {/* Mod Duplicates Section - Help with duplicate mod management */}
          <ModDuplicatesSection
            isRefreshing={isRefreshingMods}
            onRefreshStart={handleRefreshMods as any}
            onRefreshComplete={() => setIsRefreshingMods(false)}
            onCancel={() => {/* TODO: Add cancel logic if needed */}}
            onClearAll={() => handleClearInventory('mods')}
            onRemoveItem={handleRemoveFromInventory}
            refreshTrigger={inventoryRefreshTrigger}
            progress={categoryProgress?.category === 'mods' ? categoryProgress : undefined}
            lastRefreshTime={lastModRefresh}
          />

          {/* Empty state - only show when no processing and no results */}
          {!isProcessing && categorizedInventory.prime_parts.length === 0 && categorizedInventory.relics.length === 0 && categorizedInventory.mods.length === 0 && processingState.images.size === 0 && (
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