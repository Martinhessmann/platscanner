// Purpose: Portal Modal component that renders modal content at the body level
// Fixes positioning issues for modals rendered inside positioned containers

import React, { ReactNode } from 'react';
import Portal from './Portal';

interface PortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

const PortalModal: React.FC<PortalModalProps> = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <Portal>
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <div onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      </div>
    </Portal>
  );
};

export default PortalModal;