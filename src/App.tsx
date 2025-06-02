import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';

function App() {
  const [isConfigured, setIsConfigured] = useState(false);

  const handleApiKeyChange = (key: string) => {
    setIsConfigured(true);
    // Additional API key handling logic can be added here
  };

  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen bg-background-dark text-white">
        <Header onApiKeyChange={handleApiKeyChange} isConfigured={isConfigured} />
        <Routes>
          <Route path="/" element={<HomePage />} />
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