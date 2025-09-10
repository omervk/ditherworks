import { useState } from 'react';
import { ImageUpload } from '@/components/ImageUpload';
import { ImageGallery, ImageData } from '@/components/ImageGallery';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Crop, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { convertBatch, downloadBlob } from '@/lib/api';

const Index = () => {
  const [images, setImages] = useState<File[]>([]);

  const handleImagesLoaded = (files: File[]) => {
    setImages(files);
    toast.success(`Loaded ${files.length} images`);
  };

  const handleConvert = async (imageData: ImageData[]) => {
    toast.info('Starting conversion process...');
    const toSend = imageData.map((d) => ({ file: d.file, y: d.cropY }));
    const blob = await convertBatch(toSend);
    downloadBlob(blob, 'converted.zip');
    return true;
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    toast.message('Removed image from selection');
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
            <h1 className="text-3xl font-bold tracking-tight">Image Crop Tool</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload images and adjust crop positions to convert them to 800×480 format.
            Drag the crop rectangle to position it exactly where you want.
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
                <p className="font-medium text-sm">Target Format</p>
                <p className="text-xs text-muted-foreground">800×480 pixels</p>
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
                <p className="text-xs text-muted-foreground">AI-suggested positions</p>
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
            />
          </>
        )}
      </div>
    </div>
  );
};

export default Index;