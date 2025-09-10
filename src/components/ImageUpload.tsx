import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ImageUploadProps {
  onImagesLoaded: (files: File[]) => void;
}

export const ImageUpload = ({ onImagesLoaded }: ImageUploadProps) => {
  const [isDragActive, setIsDragActive] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const imageFiles = acceptedFiles.filter(file => 
      file.type.startsWith('image/')
    );
    onImagesLoaded(imageFiles);
  }, [onImagesLoaded]);

  const { getRootProps, getInputProps, open } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']
    },
    noClick: true,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
    onDropAccepted: () => setIsDragActive(false),
    onDropRejected: () => setIsDragActive(false),
  });

  const handleFolderSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.multiple = true;
    input.accept = 'image/*';
    
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      const imageFiles = files.filter(file => file.type.startsWith('image/'));
      onImagesLoaded(imageFiles);
    };
    
    input.click();
  };

  return (
    <Card className="border-2 border-dashed transition-all duration-300 ease-in-out">
      <div
        {...getRootProps()}
        className={`
          p-12 text-center cursor-pointer transition-all duration-300
          ${isDragActive 
            ? 'border-primary bg-primary/5 scale-[1.02]' 
            : 'border-border bg-surface hover:bg-surface-secondary hover:border-primary/50'
          }
        `}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center gap-4">
          <div className={`
            p-4 rounded-full transition-all duration-300
            ${isDragActive ? 'bg-primary/20' : 'bg-muted'}
          `}>
            <Upload className={`
              h-8 w-8 transition-all duration-300
              ${isDragActive ? 'text-primary scale-110' : 'text-muted-foreground'}
            `} />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">
              {isDragActive ? 'Drop your images here' : 'Upload Images'}
            </h3>
            <p className="text-muted-foreground">
              Drag and drop image files here, or use the buttons below
            </p>
          </div>
          
          <div className="flex gap-3">
            <Button onClick={open} variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Select Images
            </Button>
            <Button onClick={handleFolderSelect} variant="outline">
              <FolderOpen className="h-4 w-4 mr-2" />
              Select Folder
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground">
            Supports PNG, JPG, JPEG, GIF, BMP, WebP
          </p>
        </div>
      </div>
    </Card>
  );
};