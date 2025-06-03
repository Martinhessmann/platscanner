import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import { isGeminiConfigured, setApiKey } from './services/geminiService';

function App() {
  const [isConfigured, setIsConfigured] = useState(isGeminiConfigured());
  const [openSettings, setOpenSettings] = useState(false);

  useEffect(() => {
    // Check configuration status on mount
    setIsConfigured(isGeminiConfigured());
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

  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen bg-background-dark text-white">
        <Header
          onApiKeyChange={handleApiKeyChange}
          isConfigured={isConfigured}
          openSettings={openSettings}
          onOpenSettingsHandled={handleOpenSettingsHandled}
        />
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                isConfigured={isConfigured}
                onOpenSettings={handleOpenSettings}
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