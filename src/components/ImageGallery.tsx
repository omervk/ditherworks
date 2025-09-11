import { useState, useEffect } from 'react';
import { ImageCropPreview } from './ImageCropPreview';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Images, Crop, Check, Loader2, Trash2 } from 'lucide-react';
import { suggestCrop } from '@/lib/api';
import { toast } from 'sonner';
import { createImageId, getImageById, updateImageY } from '@/lib/storage';

const CROP_ASPECT_RATIO = 800 / 480; // 5:3 aspect ratio

export interface ImageData {
  id: string;
  file: File;
  url: string;
  cropY: number;
  naturalWidth: number;
  naturalHeight: number;
}

interface ImageGalleryProps {
  images: File[];
  onConvert: (imageData: ImageData[]) => void;
  onRemoveImage?: (index: number) => void;
  onClearAll?: () => void;
}

export const ImageGallery = ({ images, onConvert, onRemoveImage, onClearAll }: ImageGalleryProps) => {
  const [imageData, setImageData] = useState<ImageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  useEffect(() => {
    if (images.length === 0) {
      // Revoke all existing URLs when clearing list
      imageData.forEach(d => URL.revokeObjectURL(d.url));
      setImageData([]);
      setLoading(false);
      setLoadProgress(0);
      return;
    }

    setLoading(true);
    setLoadProgress(0);

    const prevById = new Map(imageData.map(d => [d.id, d]));
    const urlsToRevokeNew: string[] = [];
    const idsInNext = new Set<string>();

    const loadImages = async () => {
      const nextData: ImageData[] = [];
      let loadedCount = 0;

      for (let i = 0; i < images.length; i++) {
        const file = images[i];
        const id = createImageId(file);
        idsInNext.add(id);

        const prev = prevById.get(id);
        if (prev) {
          nextData.push({ ...prev, file });
          loadedCount++;
          setLoadProgress((loadedCount / images.length) * 100);
          continue;
        }

        const url = URL.createObjectURL(file);
        urlsToRevokeNew.push(url);

        try {
          // Get image dimensions
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = url;
          });

          // Check persisted y
          let persistedY: number | undefined = undefined;
          try {
            const rec = await getImageById(id);
            if (typeof rec?.y === 'number') persistedY = rec.y;
          } catch {}

          const initialData: ImageData = {
            id,
            file,
            url,
            cropY: persistedY ?? 0,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
          };
          nextData.push(initialData);

          // Fetch suggestion only if no persisted y
          if (persistedY === undefined) {
            suggestCrop(file)
              .then((suggest) => {
                const suggestedY = suggest?.y ?? 0;
                setImageData(prev => prev.map(d => d.id === id ? { ...d, cropY: suggestedY } : d));
                updateImageY(id, suggestedY).catch(() => {});
              })
              .catch(() => {
                // ignore suggestion errors
              });
          }

          loadedCount++;
          setLoadProgress((loadedCount / images.length) * 100);
        } catch (error) {
          console.error('Failed to load image:', file.name, error);
          toast.error(`Failed to load ${file.name}`);
        }
      }

      // Revoke URLs for items that were removed
      for (const [prevId, prev] of prevById) {
        if (!idsInNext.has(prevId)) {
          URL.revokeObjectURL(prev.url);
        }
      }

      setImageData(nextData);
      setLoading(false);
      const numNew = nextData.filter(d => !prevById.has(d.id)).length;
      if (numNew > 0) {
        toast.success(`Loaded ${numNew} new image${numNew === 1 ? '' : 's'} successfully`);
      }
    };

    loadImages();

    // Cleanup URLs created during this effect when images change/unmount
    return () => {
      urlsToRevokeNew.forEach(url => URL.revokeObjectURL(url));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images]);

  // removed simulateBackendCropPosition in favor of real backend API

  const updateCropPosition = (index: number, cropY: number) => {
    setImageData(prev => {
      const next = prev.map((data, i) => i === index ? { ...data, cropY } : data);
      const id = next[index]?.id;
      if (id) updateImageY(id, cropY).catch(() => {});
      return next;
    });
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
            <div className="flex items-center gap-2">
              {onClearAll && (
                <Button type="button" variant="outline" onClick={onClearAll} disabled={loading || converting}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
              )}
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
                  key={data.id}
                  imageData={data}
                  onCropPositionChange={(cropY) => updateCropPosition(index, cropY)}
                  onRemove={() => onRemoveImage?.(index)}
                />
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
};