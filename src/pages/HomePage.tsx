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
import { ImageState, DetectedItem, ProcessingState, VoidRelic, InventoryItem } from '../types';
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
          const analyzed = await analyzeSetProgress(categorizedInventory.prime_parts, categorizedInventory.relics);
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
        ? itemsToRefresh
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
        rarity: item.rarity || 'uncommon',
        type: item.type || 'other',
        addedAt: new Date(item.addedAt),
        lastUpdated: new Date(item.lastUpdated)
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
        updateInventoryPrices(updatedMods);

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

          // Track analysis start time to detect cache usage
          const startTime = Date.now();

          // Extract items using Gemini AI
          const analysisResult = await analyzeImage(nextImage.file);
          const detectedItems = analysisResult.items || [];
          const screenType = analysisResult.screenType || 'unknown';

          // If analysis was very fast (< 500ms), it was likely cached
          const analysisTime = Date.now() - startTime;
          const wasCached = analysisTime < 500;

          // Check if processing was stopped
          if (shouldStopProcessing) {
            setProcessingState(current => ({
              ...current,
              images: new Map(current.images).set(nextImage.id, {
                ...nextImage,
                status: 'complete',
                error: 'Processing stopped by user',
                results: [],
                screenType,
                wasCached
              }),
              processedCount: current.processedCount + 1
            }));
            return;
          }

          // Filter out items already in inventory to avoid duplicates (for ALL items including syndicate)
          const currentInventory = loadInventory();
          const existingItemNames = new Set(currentInventory.items.map(item => item.name));
          const newItems = Array.isArray(detectedItems) ? detectedItems.filter(item => !existingItemNames.has(item.name)) : [];
          const duplicatesCount = Array.isArray(detectedItems) ? detectedItems.length - newItems.length : 0;

          console.log(`>>> [AI Analysis] Detected ${Array.isArray(detectedItems) ? detectedItems.length : 0} items, ${newItems.length} are new, ${duplicatesCount} duplicates <<<`);

          // Track duplicates for this image
          setProcessingMetadata(current => ({
            ...current,
            duplicatesPerImage: new Map(current.duplicatesPerImage).set(nextImage.id, duplicatesCount)
          }));

          if (newItems.length === 0) {
            setProcessingState(current => ({
              ...current,
              images: new Map(current.images).set(nextImage.id, {
                ...nextImage,
                status: 'complete',
                results: [],
                screenType,
                wasCached
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
              syndicateRewards: newItems.filter(item => item.category === 'syndicate_rewards'), // Store syndicate rewards for price fetching
              screenType, // Store the detected screen type
              wasCached
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
                setInventoryRefreshTrigger(prev => prev + 1);
              }
              return;
            }

            const item = newItems[index];
            console.log(`>>> [Price Fetching] Processing item ${index + 1}/${newItems.length}: ${item.name} <<<`);

            // Skip price fetching for built warframe parts (non-tradeable)
            if (item.category === 'prime_parts' && !isPrimePartTradeable(item.name)) {
              console.log(`>>> [Price Fetching] Skipping built warframe part (non-tradeable): ${item.name} <<<`);
              // Add item to inventory with 0 price and mark as non-tradeable
              const nonTradeableItem: DetectedItem = {
                ...item,
                price: 0,
                status: 'loaded',
                error: undefined
              };
              // Save to inventory immediately (same pattern as processed items)
              saveToInventory([nonTradeableItem], sessionId);
              // Update categorized inventory display
              const updatedInventory = getCategorizedInventory();
              setCategorizedInventory(updatedInventory);
              setInventoryRefreshTrigger(prev => prev + 1);
              continue;
            }

            // Update current fetch item in metadata
            setProcessingMetadata(current => ({
              ...current,
              currentFetchItem: { name: item.name, index: index + 1, total: newItems.length }
            }));

            try {
              let processedItem: DetectedItem;

              if (item.category === 'relics') {
                // For relics, fetch basic price data AND calculate relic value analysis
                const priceData = await fetchSinglePriceData(item);

                if (priceData) {
                  // Calculate relic value analysis using the actual detected rarity and market price
                  const relicItem = item as VoidRelic;
                  const relicAnalysis = await calculateRelicValueAnalysis(
                    item.name,
                    relicItem.rarity || 'intact',
                    priceData.price || 0
                  );

                  if (relicAnalysis) {
                    processedItem = {
                      ...item,
                      price: priceData.price,
                      average: priceData.average,
                      marketVolume: priceData.volume,
                      lastUpdated: new Date(),
                      minDropValue: relicAnalysis.minDropValue,
                      maxDropValue: relicAnalysis.maxDropValue,
                      expectedDropValue: relicAnalysis.expectedDropValue,
                      recommendation: relicAnalysis.recommendation,
                      expectedProfit: relicAnalysis.expectedProfit,
                      directSalePrice: relicAnalysis.directSalePrice,
                      relicDrops: relicAnalysis.relicDrops,
                      refinementAnalysis: relicAnalysis.refinementAnalysis,
                      buyerUsername: priceData.buyerUsername,
                      buyerQuantity: priceData.buyerQuantity,
                      hasBuyers: priceData.hasBuyers,
                      buyerCount: priceData.buyerCount,
                      sellerCount: priceData.sellerCount,
                      status: 'loaded' as const
                    };
                  } else {
                    processedItem = {
                      ...item,
                      price: priceData.price,
                      average: priceData.average,
                      marketVolume: priceData.volume,
                      lastUpdated: new Date(),
                      buyerUsername: priceData.buyerUsername,
                      buyerQuantity: priceData.buyerQuantity,
                      hasBuyers: priceData.hasBuyers,
                      buyerCount: priceData.buyerCount,
                      sellerCount: priceData.sellerCount,
                      status: 'loaded' as const
                    };
                  }
                } else {
                  processedItem = {
                    ...item,
                    price: 0,
                    marketVolume: 0,
                    lastUpdated: new Date(),
                    status: 'error' as const
                  };
                }
              } else {
                // For mods, fetch market data first to get accurate rarity
                if (item.category === 'mods') {
                  const { calculateEndoValue, analyzeModForDuplicates, isModTradeable } = await import('../services/modService');

                  // Try to fetch price data first to get accurate rarity from Market API
                  let priceData = null;
                  let actualRarity = item.rarity || 'unknown';
                  let actualType = item.type || 'other';

                  try {
                    priceData = await fetchSinglePriceData(item);
                    if (priceData && priceData.rarity) {
                      // Use Market API rarity as authoritative source
                      const marketRarity = priceData.rarity.toLowerCase();
                      // Map market API rarity to our ModItem rarity types
                      actualRarity = marketRarity === 'common' ? 'common' :
                                   marketRarity === 'uncommon' ? 'uncommon' :
                                   marketRarity === 'rare' ? 'rare' :
                                   marketRarity === 'legendary' ? 'legendary' :
                                   marketRarity === 'primed' ? 'primed' : 'unknown';
                      // Only log in development mode to avoid console spam
                      if (__DEV_MODE__ === 'true') {
                        console.log(`>>> [Price Fetching] Updated ${item.name} rarity from "${item.rarity}" to "${actualRarity}"`);
                      }
                    }
                    // Extract type from tags if available
                    if (priceData && priceData.tags && Array.isArray(priceData.tags)) {
                      const typeFromTags = priceData.tags.find(tag =>
                        ['warframe', 'weapon', 'stance', 'archwing', 'companion', 'augment'].includes(tag.toLowerCase())
                      );
                      if (typeFromTags) {
                        actualType = typeFromTags.toLowerCase() === 'weapon' ? 'weapon' :
                                   typeFromTags.toLowerCase() === 'warframe' ? 'warframe' :
                                   typeFromTags.toLowerCase() === 'stance' ? 'stance' :
                                   typeFromTags.toLowerCase() === 'archwing' ? 'archwing' :
                                   typeFromTags.toLowerCase() === 'companion' ? 'companion' :
                                   typeFromTags.toLowerCase() === 'augment' ? 'augment' : 'other';
                      }
                    }
                  } catch {
                    // Only log in development mode to avoid console spam
                    if (__DEV_MODE__ === 'true') {
                      console.log(`>>> [Price Fetching] Could not fetch market data for ${item.name}, using fallback rarity`);
                    }
                    // If market fetch fails, check if it should be tradeable based on initial rarity
                    const fallbackTradeable = isModTradeable(item.name, actualType, actualRarity);
                    if (!fallbackTradeable) {
                      // Non-tradeable mod, don't try to fetch price
                      priceData = null;
                    }
                  }

                  const modItem: Mod = {
                    ...item,
                    price: priceData ? priceData.price : 0,
                    marketVolume: priceData ? priceData.volume : 0,
                    average: priceData ? priceData.average : 0, // Include historical average price
                    lastUpdated: new Date(),
                    status: 'loaded' as const,
                    rarity: actualRarity,
                    type: actualType,
                    imgUrl: priceData ? `https://warframe.market/static/assets/${priceData.thumb}` : undefined,
                    hasHistoricalSales: !!(priceData && (priceData.volume > 0 || priceData.average > 0)) // Consider historical sales if there's any market activity or average price
                  };

                  // Log mod price data for debugging
                  if (priceData) {
                    console.log(`>>> [Mod Price Data] ${item.name}: current=${priceData.price}p, avg=${priceData.average}p, volume=${priceData.volume}, historical=${modItem.hasHistoricalSales} <<<`);
                  }

                  // Calculate endo value and analyze for recommendations
                  const endoValue = calculateEndoValue(modItem);
                  const analyzedMod = analyzeModForDuplicates({ ...modItem, endoValue });

                  processedItem = analyzedMod;
                } else {
                  // For non-mods (prime parts, syndicate rewards)
                  const priceData = await fetchSinglePriceData(item);

                  if (priceData) {
                    // Calculate platPerStanding for syndicate rewards
                    let platPerStanding;
                    if (item.category === 'syndicate_rewards') {
                      const syndicateItem = item as SyndicateReward;
                      const standingCost = syndicateItem.standingCost || 25000; // Default to 25k for mods
                      if (priceData.price > 0 && standingCost > 0) {
                        platPerStanding = (priceData.price * 1000) / standingCost;
                        // Only log in development mode to avoid console spam
                        if (__DEV_MODE__ === 'true') {
                          console.log(`>>> [Price Fetching] ${item.name}: ${platPerStanding.toFixed(2)}p/1k standing`);
                        }
                      }
                    }

                    processedItem = {
                      ...item,
                      price: priceData.price,
                      average: priceData.average, // include historical average consistently
                      marketVolume: priceData.volume,
                      lastUpdated: new Date(),
                      ...(platPerStanding !== undefined && { platPerStanding }),
                      buyerUsername: priceData.buyerUsername,
                      buyerQuantity: priceData.buyerQuantity,
                      status: 'loaded' as const
                    };
                  } else {
                    processedItem = {
                      ...item,
                      price: 0,
                      marketVolume: 0,
                      lastUpdated: new Date(),
                      status: 'error' as const
                    };
                  }
                }
              }

              // Add to processed items
              processedItems.push(processedItem);

              // Update progress
              setFetchingProgress({ current: index + 1, total: newItems.length });

              // Save to inventory immediately
              saveToInventory([processedItem], sessionId);

              // Update categorized inventory display
              const updatedInventory = getCategorizedInventory();
              setCategorizedInventory(updatedInventory);
              setInventoryRefreshTrigger(prev => prev + 1);

              console.log(`>>> [Price Fetching] Added ${item.name} to inventory with price ${processedItem.price} (${index + 1}/${newItems.length}) <<<`);
            } catch (error) {
              console.error(`>>> [Price Fetching] Error fetching price for ${item.name}:`, error);
              // Add item without price data
              const errorItem = {
                ...item,
                price: 0,
                marketVolume: 0,
                lastUpdated: new Date(),
                status: 'error' as const,
                error: 'Failed to fetch price'
              };
              processedItems.push(errorItem);
              setFetchingProgress({ current: index + 1, total: newItems.length });

              // Save error item to inventory
              saveToInventory([errorItem], sessionId);
              const updatedInventory = getCategorizedInventory();
              setCategorizedInventory(updatedInventory);
              setInventoryRefreshTrigger(prev => prev + 1);
            }

            // Small delay to avoid overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          // After processing regular items, handle syndicate rewards if any
          if (hasSyndicateRewards && nextImage.syndicateRewards) {
            console.log(`>>> [Price Fetching] Processing ${nextImage.syndicateRewards.length} syndicate rewards <<<`);

            // Small delay to avoid rate limiting after processing regular items
            await new Promise(resolve => setTimeout(resolve, 200));

            try {
              const { fetchSyndicateRewardPrices } = await import('../services/syndicateService');

              // Fetch prices for syndicate rewards
              const updatedRewards = await fetchSyndicateRewardPrices(nextImage.syndicateRewards);

              if (updatedRewards.length > 0) {
                console.log(`>>> [Price Fetching] Fetched prices for ${updatedRewards.length} syndicate rewards <<<`);

                // Update inventory with fetched prices
                updateInventoryPrices(updatedRewards);

                // Refresh local inventory state
                const updatedInventory = getCategorizedInventory();
                setCategorizedInventory(updatedInventory);
                setInventoryRefreshTrigger(prev => prev + 1);
              }
            } catch (error) {
              console.error(`>>> [Price Fetching] Error fetching prices for syndicate rewards:`, error);
            }
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

          // Clear current fetch item
          setProcessingMetadata(current => ({
            ...current,
            currentFetchItem: undefined
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

  const handleClearInventory = useCallback((category: 'prime_parts' | 'relics' | 'syndicate_rewards') => {
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

      setLastPriceRefresh(new Date());
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
                onRefreshAll={() => handleRefreshCategoryPrices('relics')}
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
            onRefreshStart={handleRefreshSyndicateRewards}
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
            onRefreshStart={handleRefreshMods}
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