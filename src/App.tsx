import React, { useState, useCallback } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import ImageUploader from './components/ImageUploader';
import ProcessingAnimation from './components/ProcessingAnimation';
import ResultsTable from './components/ResultsTable';
import { analyzeImage, isGeminiConfigured, setApiKey } from './services/geminiService';
import { fetchPriceData } from './services/warframeMarketService';
import { ImageState, PrimePart, ProcessingState } from './types';
import InfoCard from './components/InfoCard';
import { FileWithPath } from 'react-dropzone';

function App() {
  const [processingState, setProcessingState] = useState<ProcessingState>({
    activeImageId: null,
    images: new Map(),
    combinedResults: new Map(),
    processedCount: 0,
    totalCount: 0
  });
  const [apiConfigured, setApiConfigured] = useState(isGeminiConfigured());

  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
    setApiConfigured(isGeminiConfigured());
  };

  // Helper function to generate a file hash for duplicate detection
  const getFileHash = (file: File): string => {
    return `${file.name}-${file.size}-${file.lastModified}`;
  };

  const removeImage = (id: string) => {
    setProcessingState(prev => {
      const newImages = new Map(prev.images);
      const imageToRemove = newImages.get(id);
      
      if (!imageToRemove) return prev;

      // Clean up the preview URL
      URL.revokeObjectURL(imageToRemove.preview);
      
      // Remove the image from the map
      newImages.delete(id);

      // If we're removing a queued image and it's the only one, we need to find the next one to process
      if (imageToRemove.status === 'queued') {
        const remainingQueued = Array.from(newImages.values())
          .filter(img => img.status === 'queued');
        
        if (remainingQueued.length > 0) {
          processImage(remainingQueued[0]);
        }
      }

      // Recalculate combined results
      const newCombined = new Map<string, PrimePart>();
      
      // Rebuild combined results from remaining images
      Array.from(newImages.values()).forEach(image => {
        if (image.results) {
          image.results.forEach(part => {
            const existing = newCombined.get(part.name);
            if (!existing || (part.price && (!existing.price || part.price > existing.price))) {
              newCombined.set(part.name, part);
            }
          });
        }
      });

      // Update active image if needed
      let newActiveId = prev.activeImageId;
      if (id === prev.activeImageId) {
        const remainingImages = Array.from(newImages.values());
        newActiveId = remainingImages.length > 0 ? remainingImages[0].id : null;
      }

      return {
        ...prev,
        images: newImages,
        combinedResults: newCombined,
        activeImageId: newActiveId,
        totalCount: prev.totalCount - 1
      };
    });
  };

  const processImage = async (imageState: ImageState) => {
    try {
      // Check if the image still exists in the state before processing
      setProcessingState(prev => {
        if (!prev.images.has(imageState.id)) {
          return prev; // Image was removed, don't process
        }

        return {
          ...prev,
          images: new Map(prev.images).set(imageState.id, {
            ...imageState,
            status: 'analyzing'
          })
        };
      });

      // Extract prime parts using Gemini AI
      const detectedParts = await analyzeImage(imageState.file);
      
      // Map the detected part names to PrimePart objects
      const parts: PrimePart[] = detectedParts.map((name, index) => ({
        id: `${imageState.id}-part-${index}`,
        name,
        status: 'loading'
      }));

      // Update state with detected parts
      setProcessingState(prev => {
        if (!prev.images.has(imageState.id)) {
          return prev; // Image was removed during analysis
        }

        return {
          ...prev,
          images: new Map(prev.images).set(imageState.id, {
            ...imageState,
            status: 'fetching',
            results: parts
          })
        };
      });

      // Fetch prices from market API
      const partsWithPrices = await fetchPriceData(parts);

      // Update final results
      setProcessingState(prev => {
        if (!prev.images.has(imageState.id)) {
          return prev; // Image was removed during price fetching
        }

        const newImages = new Map(prev.images);
        const newCombined = new Map(prev.combinedResults);

        // Update image results
        newImages.set(imageState.id, {
          ...imageState,
          status: 'complete',
          results: partsWithPrices
        });

        // Merge results into combined map
        partsWithPrices.forEach(part => {
          const existing = newCombined.get(part.name);
          if (!existing || (part.price && (!existing.price || part.price > existing.price))) {
            newCombined.set(part.name, part);
          }
        });

        // Find next queued image and process it
        const nextQueued = Array.from(newImages.values()).find(img => img.status === 'queued');
        if (nextQueued) {
          processImage(nextQueued);
        }

        return {
          ...prev,
          images: newImages,
          combinedResults: newCombined,
          processedCount: prev.processedCount + 1
        };
      });

    } catch (error) {
      console.error('Error processing image:', error);
      setProcessingState(prev => {
        if (!prev.images.has(imageState.id)) {
          return prev; // Image was removed during error
        }

        const newImages = new Map(prev.images);
        
        // Update current image with error
        newImages.set(imageState.id, {
          ...imageState,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        // Find next queued image and process it
        const nextQueued = Array.from(newImages.values()).find(img => img.status === 'queued');
        if (nextQueued) {
          processImage(nextQueued);
        }

        return {
          ...prev,
          images: newImages,
          processedCount: prev.processedCount + 1
        };
      });
    }
  };

  const handleImageUpload = useCallback((files: FileWithPath[]) => {
    setProcessingState(prev => {
      const newImages = new Map(prev.images);
      const newStates: ImageState[] = [];
      const existingHashes = new Set(
        Array.from(prev.images.values()).map(img => getFileHash(img.file))
      );

      // Filter out duplicates and create new states
      files.forEach(file => {
        const fileHash = getFileHash(file);
        if (!existingHashes.has(fileHash)) {
          const id = `img-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const state: ImageState = {
            id,
            file,
            preview: URL.createObjectURL(file),
            status: 'queued',
            results: []
          };
          newImages.set(id, state);
          newStates.push(state);
        }
      });

      // Only start processing if there are no images currently being processed
      const isProcessing = Array.from(prev.images.values()).some(
        img => img.status === 'analyzing' || img.status === 'fetching'
      );

      if (newStates.length > 0 && !isProcessing) {
        processImage(newStates[0]);
      }

      return {
        ...prev,
        images: newImages,
        activeImageId: newStates[0]?.id || prev.activeImageId,
        totalCount: prev.totalCount + newStates.length
      };
    });
  }, []);

  const activeImage = processingState.activeImageId 
    ? processingState.images.get(processingState.activeImageId)
    : null;

  const isProcessing = activeImage?.status === 'analyzing' || activeImage?.status === 'fetching';

  return (
    <div className="flex flex-col min-h-screen bg-background-dark text-white">
      <Header onApiKeyChange={handleApiKeyChange} isConfigured={apiConfigured} />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto relative">
          {/* Hero section */}
          <div className="mb-8 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Scan Your Warframe Inventory
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Upload screenshots of your inventory to instantly check market prices for Prime parts, mods, arcanes, weapons, and more.
            </p>
            
            {!apiConfigured && (
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
            <div className="lg:col-span-5">
              <ImageUploader 
                onImageUpload={handleImageUpload}
                isProcessing={isProcessing}
                images={processingState.images}
                activeImageId={processingState.activeImageId}
                onImageSelect={id => setProcessingState(prev => ({ ...prev, activeImageId: id }))}
                onImageRemove={removeImage}
              />
            </div>
            
            {/* Right column - Processing and Results */}
            <div className="lg:col-span-7 space-y-6">
              {!activeImage && processingState.images.size === 0 && (
                <div className="bg-background-card rounded-lg border border-gray-800 p-6 text-center">
                  <h2 className="text-xl font-semibold mb-2">Ready to Scan</h2>
                  <p className="text-gray-400">
                    Upload screenshots of your Warframe inventory to begin scanning.
                  </p>
                </div>
              )}
              
              {isProcessing && (
                <div className="bg-background-card rounded-lg border border-gray-800 p-6">
                  <ProcessingAnimation stage={activeImage?.status || 'analyzing'} />
                </div>
              )}
              
              {processingState.combinedResults.size > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">
                      Detected Items
                      <span className="ml-2 text-sm font-normal text-gray-400">
                        ({processingState.combinedResults.size} items)
                      </span>
                    </h2>
                  </div>
                  
                  <ResultsTable 
                    results={Array.from(processingState.combinedResults.values())}
                    isLoading={isProcessing}
                  />
                </div>
              )}

              {/* How it Works */}
              <InfoCard />
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}

export default App;