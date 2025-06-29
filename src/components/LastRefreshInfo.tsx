// Purpose: Reusable component to show "last refreshed X minutes ago" info for all modules
// Author: Assistant
// Last Updated: 2025-01-28

import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface LastRefreshInfoProps {
  lastRefreshDate: Date | null;
  className?: string;
}

const LastRefreshInfo: React.FC<LastRefreshInfoProps> = ({ lastRefreshDate, className = '' }) => {
  const [timeAgo, setTimeAgo] = useState<string>('');

  useEffect(() => {
    if (!lastRefreshDate) {
      setTimeAgo('Never refreshed');
      return;
    }

    const updateTimeAgo = () => {
      const now = new Date();
      const diffMs = now.getTime() - lastRefreshDate.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMinutes < 1) {
        setTimeAgo('Just refreshed');
      } else if (diffMinutes < 60) {
        setTimeAgo(`${diffMinutes}m ago`);
      } else if (diffHours < 24) {
        setTimeAgo(`${diffHours}h ago`);
      } else {
        setTimeAgo(`${diffDays}d ago`);
      }
    };

    updateTimeAgo();

    // Update every minute
    const interval = setInterval(updateTimeAgo, 60000);

    return () => clearInterval(interval);
  }, [lastRefreshDate]);

  if (!lastRefreshDate && timeAgo !== 'Never refreshed') {
    return null;
  }

  return (
    <div className={`flex items-center gap-1 text-xs text-gray-500 ${className}`}>
      <Clock size={12} />
      <span>{timeAgo}</span>
    </div>
  );
};

export default LastRefreshInfo;