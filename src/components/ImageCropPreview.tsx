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
    const naturalCropHeight = imageData.naturalWidth / CROP_ASPECT_RATIO;
    const naturalMaxY = Math.max(0, imageData.naturalHeight - naturalCropHeight);
    const clamped = Math.max(0, Math.min(naturalMaxY, imageData.cropY));
    setCropY(clamped);
  }, [imageData.cropY, imageData.naturalWidth, imageData.naturalHeight]);

  // Calculate display dimensions and crop rectangle
  const updateDimensions = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const containerWidth = container.clientWidth;
    const maxHeight = 400;

    // Calculate display dimensions maintaining aspect ratio
    const imageAspect = imageData.naturalWidth / imageData.naturalHeight;
    let displayWidth = Math.max(containerWidth, 200); // Minimum width
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

  // Observe container size changes for reliable measurements
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => updateDimensions());
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [updateDimensions]);

  // Calculate crop rectangle dimensions and position
  const getCropRectangle = () => {
    if (displayDimensions.width === 0 || displayDimensions.height === 0) return null;

    const cropWidth = displayDimensions.width;
    const cropHeight = cropWidth / CROP_ASPECT_RATIO;

    // Ensure crop height doesn't exceed display height
    const actualCropHeight = Math.min(cropHeight, displayDimensions.height * 0.9);

    // Convert original pixel cropY to display-space Y using scale
    const displayScaleY = displayDimensions.height / imageData.naturalHeight;
    const maxY = Math.max(0, displayDimensions.height - actualCropHeight);
    const scaledY = cropY * displayScaleY;
    const actualY = maxY > 0 ? Math.max(0, Math.min(maxY, scaledY)) : 0;

    const rect = {
      width: cropWidth,
      height: actualCropHeight,
      x: 0,
      y: actualY,
      maxY
    };

    console.log('Crop rectangle:', rect, 'cropY:', cropY, 'displayDimensions:', displayDimensions);

    return rect;
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

    const relativeY = e.clientY - rect.top;
    const newY = Math.max(0, Math.min(cropRect.maxY, relativeY - cropRect.height / 2));
    // Convert display-space Y back to original pixel value
    const displayScaleY = displayDimensions.height / imageData.naturalHeight;
    const newCropY = displayScaleY > 0 ? newY / displayScaleY : 0;

    setCropY(newCropY);
    onCropPositionChange(newCropY);
  }, [isDragging, onCropPositionChange, displayDimensions.height, imageData.naturalHeight]);

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
            <img
              ref={imageRef}
              src={imageData.url}
              alt={fileName}
              className="block w-full h-auto"
              style={{ maxHeight: 400 }}
              draggable={false}
            />

            {cropRect && (
              <>
                {/* Overlay dimming */}
                <div className="absolute inset-0 bg-overlay/30 pointer-events-none" />
                
                {/* Crop rectangle */}
                <div
                  className={`
                    absolute border-4 border-primary bg-primary/5 cursor-move z-10
                    transition-all duration-150 pointer-events-auto shadow-lg
                    ${isDragging ? 'border-primary/80 bg-primary/10 scale-[1.01]' : 'hover:border-primary/90 hover:bg-primary/10'}
                  `}
                  style={{
                    left: cropRect.x,
                    top: cropRect.y,
                    width: cropRect.width,
                    height: cropRect.height,
                    minHeight: '60px',
                    boxShadow: '0 0 0 2px rgba(255,255,255,0.8), inset 0 0 0 1px rgba(0,0,0,0.1)'
                  }}
                  onMouseDown={handleMouseDown}
                >
                  {/* Crop handles */}
                  <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-12 h-3 bg-primary rounded-b-md shadow-sm" />
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-12 h-3 bg-primary rounded-t-md shadow-sm" />
                  
                  {/* Crop info */}
                  <div className="absolute top-2 left-2 bg-primary text-primary-foreground px-3 py-1 rounded-md text-xs font-semibold shadow-sm">
                    800×480
                  </div>
                  
                  {/* Corner indicators */}
                  <div className="absolute top-1 left-1 w-2 h-2 bg-primary rounded-full" />
                  <div className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
                  <div className="absolute bottom-1 left-1 w-2 h-2 bg-primary rounded-full" />
                  <div className="absolute bottom-1 right-1 w-2 h-2 bg-primary rounded-full" />
                </div>
              </>
            )}
          </div>

          {/* Dimensions info */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Original: {imageData.naturalWidth}×{imageData.naturalHeight}</span>
            <span>Crop Y: {Math.round(cropY)}px</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};