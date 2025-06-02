import React from 'react';
import { ScanLine, Zap, Settings } from 'lucide-react';
import ApiKeySettings from './ApiKeySettings';

interface HeaderProps {
  onApiKeyChange: (key: string) => void;
  isConfigured: boolean;
}

const Header: React.FC<HeaderProps> = ({ onApiKeyChange, isConfigured }) => {
  return (
    <header className="bg-gradient-to-r from-background-dark to-background-light py-4 px-6 shadow-md border-b border-orokin-gold/20">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <ScanLine size={32} className="text-orokin-gold animate-pulse" />
            <Zap size={16} className="text-tenno-blue absolute -bottom-1 -right-1" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">
              <span className="text-orokin-gold">PlatScanner</span>
            </h1>
            <p className="text-xs text-gray-400 -mt-1">Inventory Value Scanner</p>
          </div>
        </div>
        
        <ApiKeySettings 
          onApiKeyChange={onApiKeyChange}
          isConfigured={isConfigured}
        />
      </div>
    </header>
  );
};

export default Header;