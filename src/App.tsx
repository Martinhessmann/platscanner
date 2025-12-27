import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import { isGeminiConfigured, setApiKey } from './services/ocrService';
import { preloadImageData } from './services/unifiedImageService';
import { migrateInventoryToLocalImages, verifyLocalImageMigration } from './services/inventoryService';

function App() {
  const [isConfigured, setIsConfigured] = useState(isGeminiConfigured());
  const [openSettings, setOpenSettings] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    // Check configuration status on mount
    setIsConfigured(isGeminiConfigured());

    // Initialize app with local images
    const initializeApp = async () => {
      try {
        // Preload the unified image data for faster image loading
        await preloadImageData();

        // Migrate any existing inventory items to use local images
        await migrateInventoryToLocalImages();

        // Verify migration completed successfully
        const verification = verifyLocalImageMigration();
        if (verification.hasExternalUrls) {
          // Only log in development mode to avoid console spam
          if (__DEV_MODE__ === 'true') {
            console.log('ℹ️ Some items still use external URLs (this is normal for new items):', verification.externalUrls.length, 'items');
          }
        } else {
          console.log('✅ CDN independence complete - all images are local');
        }
      } catch (error) {
        console.error('❌ Failed to initialize app with local images:', error);
      }
    };

    initializeApp();
  }, []);

  const handleApiKeyChange = async (key: string) => {
    try {
      const success = setApiKey(key);
      if (success) {
        setIsConfigured(true);
      } else {
        throw new Error('Failed to set API key');
      }
    } catch (error) {
      console.error('Failed to set API key:', error);
      setIsConfigured(false);
      throw error; // Re-throw to be handled by the UI
    }
  };

  const handleOpenSettings = () => {
    setOpenSettings(true);
  };

  const handleOpenSettingsHandled = () => {
    setOpenSettings(false);
  };

  const handleDataImported = () => {
    // Trigger a refresh of the UI components by incrementing the refresh trigger
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen bg-background-dark text-white">
        <Header
          onApiKeyChange={handleApiKeyChange}
          isConfigured={isConfigured}
          openSettings={openSettings}
          onOpenSettingsHandled={handleOpenSettingsHandled}
          onDataImported={handleDataImported}
        />
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                isConfigured={isConfigured}
                onOpenSettings={handleOpenSettings}
                refreshTrigger={refreshTrigger}
              />
            }
          />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
        </Routes>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;