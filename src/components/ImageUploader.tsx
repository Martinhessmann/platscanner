import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { ImageState } from '../types';
import { FileWithPath } from 'react-dropzone';

interface ImageUploaderProps {
  onImageUpload: (files: FileWithPath[]) => void;
  isProcessing: boolean;
  images: Map<string, ImageState>;
  activeImageId: string | null;
  onImageSelect: (id: string) => void;
  onImageRemove: (id: string) => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ 
  onImageUpload, 
  isProcessing, 
  images,
  activeImageId,
  onImageSelect,
  onImageRemove
}) => {
  const [skippedFiles, setSkippedFiles] = useState<string[]>([]);

  // Clear skipped files notification after delay
  const showSkippedNotification = (files: string[]) => {
    setSkippedFiles(files);
    setTimeout(() => setSkippedFiles([]), 3000);
  };

  const onDrop = (acceptedFiles: FileWithPath[]) => {
    if (acceptedFiles.length > 0) {
      // Get existing file hashes
      const existingHashes = new Set(
        Array.from(images.values()).map(img => 
          `${img.file.name}-${img.file.size}-${img.file.lastModified}`
        )
      );

      // Filter out duplicates
      const newFiles = acceptedFiles.filter(file => {
        const hash = `${file.name}-${file.size}-${file.lastModified}`;
        return !existingHashes.has(hash);
      });

      // Show notification for skipped files
      const skipped = acceptedFiles.filter(file => {
        const hash = `${file.name}-${file.size}-${file.lastModified}`;
        return existingHashes.has(hash);
      }).map(f => f.name);

      if (skipped.length > 0) {
        showSkippedNotification(skipped);
      }

      if (newFiles.length > 0) {
        onImageUpload(newFiles);
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
    },
  });

  return (
    <div>
      {/* Upload Area */}
      <div 
        {...getRootProps()} 
        className={`
          relative border-2 border-dashed rounded-lg p-4
          transition-all duration-300 text-center
          ${isDragActive ? 'border-orokin-gold bg-orokin-gold/10' : 'border-gray-600 hover:border-orokin-gold/70 hover:bg-background-light'}
        `}
      >
        <input {...getInputProps()} multiple />
        
        <div className="flex items-center justify-center gap-4 py-2">
          <div className="p-2 rounded-full bg-background-light text-tenno-blue">
            {isDragActive ? (
              <Upload size={24} className="animate-bounce" />
            ) : (
              <ImageIcon size={24} />
            )}
          </div>
          
          <div className="text-left">
            <p className="font-medium text-gray-300">
              {isDragActive 
                ? "Drop screenshots here" 
                : "Upload screenshots"}
            </p>
            <p className="text-sm text-gray-400">
              Drag and drop or click to browse
            </p>
          </div>

          {/* Skipped Files Notification */}
          {skippedFiles.length > 0 && (
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-background-dark/80 rounded-b-lg text-sm text-gray-300 flex items-center justify-center gap-2 animate-fade-in">
              <AlertCircle size={16} className="text-orokin-gold" />
              <span>
                Skipped {skippedFiles.length} duplicate {skippedFiles.length === 1 ? 'file' : 'files'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageUploader;