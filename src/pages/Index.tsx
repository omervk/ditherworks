import { useState, useEffect } from 'react';
import { ImageUpload } from '@/components/ImageUpload';
import { ImageGallery, ImageData } from '@/components/ImageGallery';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Crop, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { convertBatch, downloadBlob } from '@/lib/api';
import { getAllImages, upsertImages, removeImage as removeStoredImage, clearAllImages, createImageId } from '@/lib/storage';

const Index = () => {
  const [images, setImages] = useState<File[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const stored = await getAllImages();
        if (stored.length > 0) {
          const files = stored.map((r) => new File([r.blob], r.name, { type: r.type, lastModified: r.lastModified }));
          setImages(files);
          toast.message(`Restored ${files.length} image${files.length === 1 ? '' : 's'}`);
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  const handleImagesLoaded = async (files: File[]) => {
    try {
      await upsertImages(files);
    } catch {}
    setImages((prev) => {
      const byId = new Map(prev.map((f) => [createImageId(f), f]));
      for (const f of files) byId.set(createImageId(f), f);
      return Array.from(byId.values());
    });
    toast.success(`Loaded ${files.length} image${files.length === 1 ? '' : 's'}`);
  };

  const handleConvert = async (imageData: ImageData[]) => {
    toast.info('Starting conversion process...');
    const toSend = imageData.map((d) => ({ file: d.file, y: d.cropY }));
    const blob = await convertBatch(toSend);
    downloadBlob(blob, 'converted.zip');
    return true;
  };

  const handleRemoveImage = async (index: number) => {
    setImages((prev) => {
      const file = prev[index];
      if (file) {
        const id = createImageId(file);
        removeStoredImage(id).catch(() => {});
      }
      return prev.filter((_, i) => i !== index);
    });
    toast.message('Removed image from selection');
  };

  const handleClearAll = async () => {
    try {
      await clearAllImages();
    } catch {}
    setImages([]);
    toast.message('Cleared all images');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 rounded-full bg-gradient-primary">
              <Crop className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Image Conversion for PhotoPainter</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload images, then drag the crop rectangle to position it exactly where you want.
          </p>
        </div>

        {/* Info Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="p-2 rounded-full bg-info/20">
                <Info className="h-4 w-4 text-info" />
              </div>
              <div>
                <p className="font-medium text-sm">Local-only</p>
                <p className="text-xs text-muted-foreground">Everything stays on your machine</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="p-2 rounded-full bg-success/20">
                <Crop className="h-4 w-4 text-success" />
              </div>
              <div>
                <p className="font-medium text-sm">Smart Cropping</p>
                <p className="text-xs text-muted-foreground">Face-detection suggests optimal crop</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="p-2 rounded-full bg-warning/20">
                <Badge className="h-4 w-4 text-warning" />
              </div>
              <div>
                <p className="font-medium text-sm">Batch Processing</p>
                <p className="text-xs text-muted-foreground">Process all at once</p>
              </div>
            </CardContent>
          </Card> 
        </div>

        {/* Upload Section */}
        <div className="mb-8">
          <ImageUpload onImagesLoaded={handleImagesLoaded} />
        </div>

        {images.length > 0 && (
          <>
            <Separator className="my-8" />
            
            {/* Gallery Section */}
            <ImageGallery 
              images={images} 
              onConvert={handleConvert}
              onRemoveImage={handleRemoveImage}
              onClearAll={handleClearAll}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default Index;