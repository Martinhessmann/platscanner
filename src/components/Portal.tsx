// Purpose: Portal component for rendering modals at the body level
// Fixes positioning issues when modals are rendered inside positioned containers

import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
  children: ReactNode;
  containerId?: string;
}

const Portal: React.FC<PortalProps> = ({ children, containerId = 'portal-root' }) => {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Try to find existing container
    let portalContainer = document.getElementById(containerId);

    // Create container if it doesn't exist
    if (!portalContainer) {
      portalContainer = document.createElement('div');
      portalContainer.id = containerId;
      portalContainer.style.position = 'relative';
      portalContainer.style.zIndex = '9999';
      document.body.appendChild(portalContainer);
    }

    setContainer(portalContainer);

    // Cleanup function to remove container if we created it
    return () => {
      if (portalContainer && portalContainer.children.length === 0) {
        portalContainer.remove();
      }
    };
  }, [containerId]);

  if (!container) {
    return null;
  }

  return createPortal(children, container);
};

export default Portal;