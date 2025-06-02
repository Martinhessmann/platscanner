import React, { useState, useCallback } from 'react';
import ImageUploader from '../components/ImageUploader';
import ProcessingAnimation from '../components/ProcessingAnimation';
import ResultsTable from '../components/ResultsTable';
import { analyzeImage, isGeminiConfigured } from '../services/geminiService';
import { fetchPriceData } from '../services/warframeMarketService';
import { ImageState, PrimePart, ProcessingState } from '../types';
import InfoCard from '../components/InfoCard';
import { FileWithPath } from 'react-dropzone';

const HomePage: React.FC = () => {
  const [processingState, setProcessingState] = useState<ProcessingState>({
    activeImageId: null,
    images: new Map(),
    combinedResults: new Map(),
    processedCount: 0,
    totalCount: 0
  });

  const processNextImage = useCallback(async () => {
    const queuedImage = Array.from(processingState.images.values()).find(
      img => img.status === 'queued'
    );

    if (!queuedImage) return;

    try {
      // Update status to analyzing
      setProcessingState(prev => ({
        ...prev,
        images: new Map(prev.images).set(queuedImage.id, {
          ...queuedImage,
          status: 'analyzing'
        }),
        activeImageId: queuedImage.id
      }));

      // Extract prime parts using Gemini AI
      const detectedParts = await analyzeImage(queuedImage.file);
      
      // Map the detected part names to PrimePart objects
      const parts: PrimePart[] = detectedParts.map((name, index) => ({
        id: `${queuedImage.id}-part-${index}`,
        name,
        status: 'loading'
      }));

      // Update state with detected parts while preserving existing results
      setProcessingState(prev => ({
        ...prev,
        images: new Map(prev.images).set(queuedImage.id, {
          ...queuedImage,
          status: 'fetching',
          results: parts
        })
      }));

      // Fetch prices from market API
      const partsWithPrices = await fetchPriceData(parts);

      // Update final results while preserving existing ones
      setProcessingState(prev => {
        const newImages = new Map(prev.images);
        const newCombined = new Map(prev.combinedResults);

        // Update image results
        newImages.set(queuedImage.id, {
          ...queuedImage,
          status: 'complete',
          results: partsWithPrices
        });

        // Merge new results with existing ones
        partsWithPrices.forEach(part => {
          const existing = newCombined.get(part.name);
          if (!existing || (part.price && (!existing.price || part.price > existing.price))) {
            newCombined.set(part.name, part);
          }
        });

        // Process next image if available
        const nextImage = Array.from(newImages.values()).find(
          img => img.status === 'queued'
        );
        if (nextImage) {
          processNextImage();
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
      setProcessingState(prev => ({
        ...prev,
        images: new Map(prev.images).set(queuedImage.id, {
          ...queuedImage,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }));

      // Try processing next image even if current one failed
      processNextImage();
    }
  }, []);

  const handleImageUpload = useCallback((files: FileWithPath[]) => {
    setProcessingState(prev => {
      const newImages = new Map(prev.images);
      const newStates: ImageState[] = [];

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
        newStates.push(state);
      });

      // Start processing the first image
      if (newStates.length > 0) {
        processNextImage();
      }

      return {
        ...prev,
        images: newImages,
        activeImageId: newStates[0]?.id || prev.activeImageId,
        totalCount: prev.totalCount + files.length
      };
    });
  }, [processNextImage]);

  const handleImageRemove = useCallback((id: string) => {
    setProcessingState(prev => {
      const newImages = new Map(prev.images);
      const imageToRemove = newImages.get(id);
      newImages.delete(id);

      // Recalculate combined results excluding the removed image
      const newCombined = new Map();
      newImages.forEach(image => {
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
      if (newActiveId === id) {
        const remainingIds = Array.from(newImages.keys());
        newActiveId = remainingIds[0] || null;
      }

      return {
        ...prev,
        images: newImages,
        combinedResults: newCombined,
        activeImageId: newActiveId,
        processedCount: Math.max(0, prev.processedCount - (imageToRemove?.status === 'complete' ? 1 : 0)),
        totalCount: Math.max(0, prev.totalCount - 1)
      };
    });
  }, []);

  const activeImage = processingState.activeImageId 
    ? processingState.images.get(processingState.activeImageId)
    : null;

  const isProcessing = activeImage?.status === 'analyzing' || activeImage?.status === 'fetching';

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
          <div className="lg:col-span-5">
            <ImageUploader 
              onImageUpload={handleImageUpload}
              isProcessing={isProcessing}
              images={processingState.images}
              activeImageId={processingState.activeImageId}
              onImageSelect={id => setProcessingState(prev => ({ ...prev, activeImageId: id }))}
              onImageRemove={handleImageRemove}
            />
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
                  
                  {activeImage?.status === 'complete' && (
                    <div className="px-3 py-1 rounded-full bg-corpus-green/20 text-corpus-green text-xs font-medium">
                      Scan Complete
                    </div>
                  )}
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
  );
};

export default HomePage;