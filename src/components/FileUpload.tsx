import React, { useRef, useState, useEffect } from 'react';
import { Camera, Upload, FileText, X } from 'lucide-react';
import { ImageModal } from './ImageModal';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  selectedFile?: File | null;
  onClearFile: () => void;
  existingFileUrl?: string;
}

export function FileUpload({ onFileSelect, selectedFile, onClearFile, existingFileUrl }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string>('');
  const [isPdf, setIsPdf] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const loadPreview = async () => {
      console.log('--- loadPreview ---');
      console.log('selectedFile:', selectedFile);
      console.log('existingFileUrl:', existingFileUrl);

      if (selectedFile) {
        setIsPdf(selectedFile.type.includes('pdf'));
        if (selectedFile.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (e) => {
            setPreview(e.target?.result as string);
            console.log('Preview URL for selected file (image):', e.target?.result);
          };
          reader.readAsDataURL(selectedFile);
        } else {
          const blobUrl = URL.createObjectURL(selectedFile);
          setPreview(blobUrl);
          console.log('Preview URL for selected file (pdf):', blobUrl);
        }
      } else if (existingFileUrl) {
        // For Supabase storage, the existingFileUrl is already the public URL
        setPreview(existingFileUrl);
        console.log('Using existing file URL:', existingFileUrl);
        
        // Determine file type from URL extension
        setIsPdf(existingFileUrl.toLowerCase().includes('.pdf'));
      } else {
        setPreview('');
        setIsPdf(false);
      }
    };

    loadPreview();
  }, [selectedFile, existingFileUrl]);

  const handleFileSelect = (file: File) => {
    console.log('handleFileSelect file:', file);
    onFileSelect(file);
  };

  const handleClearFile = () => {
    console.log('handleClearFile called');
    onClearFile();
    setPreview('');
    setIsPdf(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="flex items-center justify-center gap-3 p-6 border-2 border-dashed border-blue-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all duration-200"
        >
          <Camera className="w-6 h-6 text-blue-600" />
          <span className="text-blue-600 font-medium">Take Photo</span>
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center gap-3 p-6 border-2 border-dashed border-emerald-300 rounded-xl hover:border-emerald-400 hover:bg-emerald-50 transition-all duration-200"
        >
          <Upload className="w-6 h-6 text-emerald-600" />
          <span className="text-emerald-600 font-medium">Upload File</span>
        </button>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        className="hidden"
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        className="hidden"
      />

      {(selectedFile || existingFileUrl) && (
        <div className="relative bg-gray-50 rounded-xl p-4 border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {isPdf ? <FileText className="w-5 h-5 text-red-600" /> : <Camera className="w-5 h-5 text-blue-600" />}
              <span className="text-sm font-medium text-gray-700 truncate">
                {selectedFile?.name || 'Current invoice file'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleClearFile}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {preview && !isPdf && (
            <div className="rounded-lg overflow-hidden border">
              <img
                src={preview}
                alt="Invoice preview"
                className="w-full h-48 object-contain bg-white cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setShowModal(true)}
                title="Click to view fullscreen"
              />
            </div>
          )}

          {isPdf && (
            <div
              className="flex items-center justify-center h-32 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors"
              onClick={() => setShowModal(true)}
              title="Click to view fullscreen"
            >
              <div className="text-center">
                <FileText className="w-8 h-8 text-red-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">PDF Ready for Upload</p>
                <p className="text-xs text-gray-500 mt-1">Click to preview</p>
              </div>
            </div>
          )}
        </div>
      )}

      {(preview || isPdf) && (
        <ImageModal
          src={preview}
          alt="Invoice preview"
          isPdf={isPdf}
          isOpen={showModal}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
