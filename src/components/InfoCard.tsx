import React from 'react';
import { Info, HelpCircle, ArrowRight } from 'lucide-react';

const InfoCard: React.FC = () => {
  return (
    <div className="bg-background-card rounded-lg border border-gray-800 p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 rounded-full bg-orokin-gold/10 text-orokin-gold">
          <Info size={20} />
        </div>
        <h2 className="text-lg font-semibold pt-1">How It Works</h2>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-background-light text-tenno-blue flex items-center justify-center flex-shrink-0 mt-0.5">
            1
          </div>
          <div>
            <p className="text-sm text-gray-300">
              Upload a screenshot of your Warframe inventory showing Prime parts
            </p>
          </div>
        </div>
        
        <div className="flex items-center justify-center py-1">
          <ArrowRight size={16} className="text-gray-600" />
        </div>
        
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-background-light text-tenno-blue flex items-center justify-center flex-shrink-0 mt-0.5">
            2
          </div>
          <div>
            <p className="text-sm text-gray-300">
              Our AI analyzes the image to identify Prime part names using Google Gemini
            </p>
          </div>
        </div>
        
        <div className="flex items-center justify-center py-1">
          <ArrowRight size={16} className="text-gray-600" />
        </div>
        
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-background-light text-tenno-blue flex items-center justify-center flex-shrink-0 mt-0.5">
            3
          </div>
          <div>
            <p className="text-sm text-gray-300">
              We fetch current market prices from Warframe Market's API
            </p>
          </div>
        </div>
        
        <div className="flex items-center justify-center py-1">
          <ArrowRight size={16} className="text-gray-600" />
        </div>
        
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-background-light text-tenno-blue flex items-center justify-center flex-shrink-0 mt-0.5">
            4
          </div>
          <div>
            <p className="text-sm text-gray-300">
              View a sorted list showing the value of your Prime parts
            </p>
          </div>
        </div>
      </div>
      
      <div className="mt-6 pt-4 border-t border-gray-800">
        <div className="flex items-start gap-2">
          <HelpCircle size={16} className="text-gray-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500">
            Tip: For best results, take a screenshot with clear text and good lighting. 
            The scanner works best with the default Warframe UI.
          </p>
        </div>
      </div>
    </div>
  );
};

export default InfoCard;