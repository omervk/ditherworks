import { useState, useEffect } from 'react';
import { ImageCropPreview } from './ImageCropPreview';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Images, Crop, Check, Loader2 } from 'lucide-react';
import { suggestCrop } from '@/lib/api';
import { toast } from 'sonner';

const CROP_ASPECT_RATIO = 800 / 480; // 5:3 aspect ratio

export interface ImageData {
  file: File;
  url: string;
  cropY: number;
  naturalWidth: number;
  naturalHeight: number;
}

interface ImageGalleryProps {
  images: File[];
  onConvert: (imageData: ImageData[]) => void;
}

export const ImageGallery = ({ images, onConvert }: ImageGalleryProps) => {
  const [imageData, setImageData] = useState<ImageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  useEffect(() => {
    if (images.length === 0) {
      setImageData([]);
      return;
    }

    setLoading(true);
    setLoadProgress(0);
    
    const loadImages = async () => {
      const newImageData: ImageData[] = [];
      
      for (let i = 0; i < images.length; i++) {
        const file = images[i];
        const url = URL.createObjectURL(file);
        
        try {
          // Get image dimensions
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = url;
          });

          // Request backend to suggest initial crop position (pixels from top)
          let y = 0;
          try {
            const suggest = await suggestCrop(file);
            y = suggest.y || 0;
          } catch (e) {
            // Fallback to top if suggest fails
            y = 0;
          }
          
          newImageData.push({
            file,
            url,
            cropY: y,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
          });
          
          setLoadProgress(((i + 1) / images.length) * 100);
        } catch (error) {
          console.error('Failed to load image:', file.name, error);
          toast.error(`Failed to load ${file.name}`);
        }
      }
      
      setImageData(newImageData);
      setLoading(false);
      
      if (newImageData.length > 0) {
        toast.success(`Loaded ${newImageData.length} images successfully`);
      }
    };

    loadImages();
    
    // Cleanup URLs when component unmounts
    return () => {
      imageData.forEach(data => URL.revokeObjectURL(data.url));
    };
  }, [images]);

  // removed simulateBackendCropPosition in favor of real backend API

  const updateCropPosition = (index: number, cropY: number) => {
    setImageData(prev => 
      prev.map((data, i) => 
        i === index ? { ...data, cropY } : data
      )
    );
  };

  const handleConvert = async () => {
    setConverting(true);
    try {
      await onConvert(imageData);
      toast.success('Conversion completed successfully!');
    } catch (error) {
      toast.error('Conversion failed. Please try again.');
    } finally {
      setConverting(false);
    }
  };

  if (images.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="p-4 rounded-full bg-muted mb-4">
            <Images className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium text-muted-foreground">No images loaded</p>
          <p className="text-sm text-muted-foreground">Upload some images to get started</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2">
                <Crop className="h-5 w-5" />
                Image Gallery
              </CardTitle>
              <Badge variant="secondary">
                {imageData.length} images
              </Badge>
            </div>
            
            <Button 
              onClick={handleConvert}
              disabled={loading || imageData.length === 0 || converting}
              className="min-w-[120px]"
            >
              {converting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Convert All
                </>
              )}
            </Button>
          </div>
          
          {loading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Loading images...</span>
                <span>{Math.round(loadProgress)}%</span>
              </div>
              <Progress value={loadProgress} />
            </div>
          )}
        </CardHeader>
        
        {!loading && imageData.length > 0 && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {imageData.map((data, index) => (
                <ImageCropPreview
                  key={data.file.name}
                  imageData={data}
                  onCropPositionChange={(cropY) => updateCropPosition(index, cropY)}
                />
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
};