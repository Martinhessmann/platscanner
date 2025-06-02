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
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ 
  onImageUpload, 
  isProcessing, 
  images,
  activeImageId,
  onImageSelect,
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

  const removeImage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Implementation needed: Remove image from state
  };

  return (
    <div className="space-y-4">
      {/* Image Queue */}
      {images.size > 0 && (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-2">
            {Array.from(images.values()).map(image => (
              <div 
                key={image.id}
                onClick={() => onImageSelect(image.id)}
                className={`
                  relative rounded-lg overflow-hidden cursor-pointer border-2
                  ${activeImageId === image.id ? 'border-orokin-gold' : 'border-gray-700'}
                  ${image.status === 'error' ? 'border-grineer-red' : ''}
                  hover:border-orokin-gold/70 transition-colors
                `}
              >
                <img 
                  src={image.preview} 
                  alt="Screenshot preview"
                  className="h-20 w-20 object-cover"
                />
                <div className="absolute top-0 left-0 right-0 px-2 py-1 text-xs bg-black/50 truncate">
                  {image.file.name}
                </div>
                <div className={`
                  absolute bottom-0 left-0 right-0 px-2 py-1 text-xs
                  ${image.status === 'complete' ? 'bg-corpus-green/80' : 
                    image.status === 'error' ? 'bg-grineer-red/80' :
                    'bg-black/50'}
                `}>
                  {image.status === 'queued' && 'Queued'}
                  {image.status === 'analyzing' && 'Analyzing...'}
                  {image.status === 'fetching' && 'Fetching...'}
                  {image.status === 'complete' && 'Complete'}
                  {image.status === 'error' && 'Error'}
                </div>
                {!isProcessing && (
                  <button
                    onClick={(e) => removeImage(image.id, e)}
                    className="absolute top-1 right-1 bg-grineer-red text-white p-1 rounded-full hover:bg-grineer-dark transition-colors"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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