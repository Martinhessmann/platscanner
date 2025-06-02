import React from 'react';
import { Github, ExternalLink } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-background-dark py-4 px-6 border-t border-orokin-gold/20">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <p className="text-gray-400 text-sm">
              <span className="text-orokin-gold">PlatScanner</span> is not affiliated with Digital Extremes Ltd.
            </p>
            <p className="text-gray-500 text-xs">
              Warframe and the Warframe logo are trademarks of Digital Extremes Ltd.
            </p>
          </div>
          
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <a 
              href="https://warframe.market" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-orokin-gold transition-colors text-sm flex items-center gap-1"
            >
              Warframe Market <ExternalLink size={14} />
            </a>
            <a 
              href="https://warframe.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-orokin-gold transition-colors text-sm flex items-center gap-1"
            >
              Warframe Official <ExternalLink size={14} />
            </a>
            <a 
              href="https://github.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-orokin-gold transition-colors"
            >
              <Github size={20} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;