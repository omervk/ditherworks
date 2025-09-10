import { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ImageData } from './ImageGallery';

interface ImageCropPreviewProps {
  imageData: ImageData;
  onCropPositionChange: (cropY: number) => void;
}

const CROP_ASPECT_RATIO = 800 / 480; // 5:3 aspect ratio

export const ImageCropPreview = ({ imageData, onCropPositionChange }: ImageCropPreviewProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [cropY, setCropY] = useState(imageData.cropY);
  const [displayDimensions, setDisplayDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Update crop position when imageData changes
  useEffect(() => {
    setCropY(imageData.cropY);
  }, [imageData.cropY]);

  // Calculate display dimensions and crop rectangle
  const updateDimensions = useCallback(() => {
    if (!imageRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const containerWidth = container.clientWidth - 32; // Account for padding
    const maxHeight = 400;

    // Calculate display dimensions maintaining aspect ratio
    const imageAspect = imageData.naturalWidth / imageData.naturalHeight;
    let displayWidth = containerWidth;
    let displayHeight = displayWidth / imageAspect;

    if (displayHeight > maxHeight) {
      displayHeight = maxHeight;
      displayWidth = displayHeight * imageAspect;
    }

    setDisplayDimensions({ width: displayWidth, height: displayHeight });
  }, [imageData.naturalWidth, imageData.naturalHeight]);

  useEffect(() => {
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [updateDimensions]);

  // Calculate crop rectangle dimensions and position
  const getCropRectangle = () => {
    if (displayDimensions.width === 0) return null;

    const cropWidth = displayDimensions.width;
    const cropHeight = cropWidth / CROP_ASPECT_RATIO;
    const maxY = displayDimensions.height - cropHeight;
    const actualY = Math.max(0, Math.min(maxY, (cropY / 100) * maxY));

    return {
      width: cropWidth,
      height: cropHeight,
      x: 0,
      y: actualY,
      maxY
    };
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const cropRect = getCropRectangle();
    
    if (!cropRect) return;

    const relativeY = e.clientY - rect.top - 16; // Account for padding
    const newY = Math.max(0, Math.min(cropRect.maxY, relativeY - cropRect.height / 2));
    const newCropY = cropRect.maxY > 0 ? (newY / cropRect.maxY) * 100 : 0;

    setCropY(newCropY);
    onCropPositionChange(newCropY);
  }, [isDragging, onCropPositionChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const cropRect = getCropRectangle();
  const fileName = imageData.file.name;
  const fileSize = (imageData.file.size / 1024 / 1024).toFixed(1);

  return (
    <Card className="overflow-hidden transition-all duration-200 hover:shadow-md">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Image info */}
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm truncate flex-1 mr-2" title={fileName}>
              {fileName}
            </h3>
            <Badge variant="outline" className="text-xs">
              {fileSize}MB
            </Badge>
          </div>

          {/* Image with crop overlay */}
          <div 
            ref={containerRef}
            className="relative bg-muted rounded-md overflow-hidden"
            style={{ minHeight: '200px' }}
          >
            {displayDimensions.width > 0 && (
              <>
                <img
                  ref={imageRef}
                  src={imageData.url}
                  alt={fileName}
                  className="block"
                  style={{
                    width: displayDimensions.width,
                    height: displayDimensions.height,
                  }}
                  draggable={false}
                />

                {cropRect && (
                  <>
                    {/* Overlay dimming */}
                    <div className="absolute inset-0 bg-overlay/30 pointer-events-none" />
                    
                    {/* Crop rectangle */}
                    <div
                      className={`
                        absolute border-2 border-crop-overlay bg-transparent cursor-move
                        transition-all duration-150 pointer-events-auto
                        ${isDragging ? 'shadow-lg scale-[1.02]' : 'hover:shadow-md hover:border-crop-overlay/80'}
                      `}
                      style={{
                        left: cropRect.x,
                        top: cropRect.y,
                        width: cropRect.width,
                        height: cropRect.height,
                      }}
                      onMouseDown={handleMouseDown}
                    >
                      {/* Crop handles */}
                      <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-8 h-2 bg-crop-overlay rounded-b-sm opacity-80" />
                      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-8 h-2 bg-crop-overlay rounded-t-sm opacity-80" />
                      
                      {/* Crop info */}
                      <div className="absolute top-1 left-1 bg-crop-overlay text-crop-handle px-2 py-1 rounded text-xs font-medium">
                        800×480
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Dimensions info */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Original: {imageData.naturalWidth}×{imageData.naturalHeight}</span>
            <span>Crop Y: {Math.round(cropY)}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};