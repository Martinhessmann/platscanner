import React from 'react';
import { Scan, Sparkles, Zap } from 'lucide-react';

interface ProcessingAnimationProps {
  stage: 'analyzing' | 'fetching' | 'complete';
}

const ProcessingAnimation: React.FC<ProcessingAnimationProps> = ({ stage }) => {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="relative w-24 h-24 mb-6">
        {/* Base circle with glow effect */}
        <div className="absolute inset-0 rounded-full bg-background-card border border-orokin-gold/30 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-tenno-blue/20 to-orokin-gold/20 animate-pulse-slow"></div>
        </div>

        {/* Icon based on stage */}
        <div className="absolute inset-0 flex items-center justify-center">
          {stage === 'analyzing' && (
            <Scan size={36} className="text-tenno-blue animate-pulse" />
          )}
          {stage === 'fetching' && (
            <Zap size={36} className="text-orokin-gold animate-pulse" />
          )}
          {stage === 'complete' && (
            <Sparkles size={36} className="text-corpus-green animate-float" />
          )}
        </div>

        {/* Orbiting particles */}
        <div className="absolute inset-0 rounded-full animate-spin" style={{ animationDuration: '8s' }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-tenno-blue"></div>
        </div>
        <div className="absolute inset-0 rounded-full animate-spin" style={{ animationDuration: '12s', animationDirection: 'reverse' }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-orokin-gold"></div>
        </div>
      </div>

      {/* Status text */}
      <h3 className="text-xl font-semibold text-white mb-2">
        {stage === 'analyzing' && "Analyzing Screenshot"}
        {stage === 'fetching' && "Fetching Market Prices"}
        {stage === 'complete' && "Processing Complete"}
      </h3>
      
      <p className="text-gray-400 text-center max-w-md">
        {stage === 'analyzing' && "Gemini AI is scanning your inventory for Prime parts..."}
        {stage === 'fetching' && "Retrieving current market prices from Warframe Market..."}
        {stage === 'complete' && "Your results are ready to view!"}
      </p>
    </div>
  );
};

export default ProcessingAnimation;