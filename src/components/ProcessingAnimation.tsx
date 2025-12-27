import React from 'react';
import { Scan, Sparkles, Zap, XCircle, Clock } from 'lucide-react';

interface ProcessingAnimationProps {
  stage: 'analyzing' | 'analyzed' | 'fetching' | 'complete';
  progress?: {
    current: number;
    total: number;
  };
  onStop?: () => void;
  canStop?: boolean;
}

const ProcessingAnimation: React.FC<ProcessingAnimationProps> = ({
  stage,
  progress,
  onStop,
  canStop = false
}) => {
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
          {stage === 'analyzed' && (
            <Clock size={36} className="text-corpus-green animate-pulse" />
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
        {stage === 'analyzed' && "Analysis Complete"}
        {stage === 'fetching' && `Fetching Market Prices${progress ? ` (${progress.current}/${progress.total})` : ''}`}
        {stage === 'complete' && "Processing Complete"}
      </h3>

      <p className="text-gray-400 text-center max-w-md">
        {stage === 'analyzing' && "OCR is extracting text from your screenshot to identify Prime parts, Relics, Mods, and Syndicate rewards..."}
        {stage === 'analyzed' && "Items detected! Queued for market price fetching..."}
        {stage === 'fetching' && "Retrieving current market prices from Warframe Market..."}
        {stage === 'complete' && "Your results are ready to view!"}
      </p>

      {/* Stop button - only show during fetching and if canStop is true */}
      {stage === 'fetching' && canStop && onStop && (
        <button
          onClick={onStop}
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-grineer-red/20 hover:bg-grineer-red/40 border border-grineer-red/50 text-grineer-red rounded-lg transition-colors"
          title="Stop processing"
        >
          <XCircle size={16} />
          <span>Stop Processing</span>
        </button>
      )}
    </div>
  );
};

export default ProcessingAnimation;