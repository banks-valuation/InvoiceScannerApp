import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ImageModalProps {
  src: string;
  alt: string;
  isPdf?: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export function ImageModal({ src, alt, isPdf = false, isOpen, onClose }: ImageModalProps) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = useState(0);
  const [lastTouchCenter, setLastTouchCenter] = useState({ x: 0, y: 0 });
  const [isMultiTouch, setIsMultiTouch] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setZoom(1);
      setPosition({ x: 0, y: 0 });
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 5));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.1));
  };

  const handleReset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  // Helper function to get touch distance
  const getTouchDistance = (touches: TouchList) => {
    if (touches.length < 2) return 0;
    const touch1 = touches[0];
    const touch2 = touches[1];
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) + 
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );
  };

  // Helper function to get touch center point
  const getTouchCenter = (touches: TouchList) => {
    if (touches.length === 1) {
      return { x: touches[0].clientX, y: touches[0].clientY };
    }
    if (touches.length >= 2) {
      return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
      };
    }
    return { x: 0, y: 0 };
  };

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    
    if (e.touches.length === 2) {
      // Two finger pinch
      setIsMultiTouch(true);
      setIsDragging(false);
      setLastTouchDistance(getTouchDistance(e.touches));
      setLastTouchCenter(getTouchCenter(e.touches));
    } else if (e.touches.length === 1 && zoom > 1) {
      // Single finger pan (only when zoomed)
      setIsMultiTouch(false);
      setIsDragging(true);
      const touch = e.touches[0];
      setDragStart({
        x: touch.clientX - position.x,
        y: touch.clientY - position.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    
    if (e.touches.length === 2 && isMultiTouch) {
      // Handle pinch zoom
      const currentDistance = getTouchDistance(e.touches);
      const currentCenter = getTouchCenter(e.touches);
      
      if (lastTouchDistance > 0) {
        const scale = currentDistance / lastTouchDistance;
        const newZoom = Math.min(Math.max(zoom * scale, 0.1), 5);
        setZoom(newZoom);
        
        // Adjust position to zoom towards the center of the pinch
        const centerDelta = {
          x: currentCenter.x - lastTouchCenter.x,
          y: currentCenter.y - lastTouchCenter.y
        };
        
        setPosition(prev => ({
          x: prev.x + centerDelta.x,
          y: prev.y + centerDelta.y
        }));
      }
      
      setLastTouchDistance(currentDistance);
      setLastTouchCenter(currentCenter);
    } else if (e.touches.length === 1 && isDragging && zoom > 1) {
      // Handle single finger pan
      const touch = e.touches[0];
      setPosition({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    
    if (e.touches.length === 0) {
      setIsDragging(false);
      setIsMultiTouch(false);
      setLastTouchDistance(0);
    } else if (e.touches.length === 1 && isMultiTouch) {
      // Transition from pinch to pan
      setIsMultiTouch(false);
      if (zoom > 1) {
        setIsDragging(true);
        const touch = e.touches[0];
        setDragStart({
          x: touch.clientX - position.x,
          y: touch.clientY - position.y,
        });
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.min(Math.max(prev * delta, 0.1), 5));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center">
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomIn}
            className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg text-white transition-colors"
            title="Zoom In (+)"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg text-white transition-colors"
            title="Zoom Out (-)"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <button
            onClick={handleReset}
            className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg text-white transition-colors"
            title="Reset (0)"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <span className="text-white text-sm bg-white bg-opacity-20 px-3 py-2 rounded-lg">
            {Math.round(zoom * 100)}%
          </span>
        </div>
        
        <button
          onClick={onClose}
          className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg text-white transition-colors"
          title="Close (Esc)"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div
        className="w-full h-full flex items-center justify-center overflow-hidden cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: isPdf ? 'default' : (zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default') }}
      >
      {isPdf ? (
        <iframe
          src={src}
          title={alt}
          className="w-full h-full border-0"
        />
      ) : (
        <img
          src={src}
          alt={alt}
          className="max-w-none transition-transform duration-200 select-none"
          style={{
            transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
          }}
          draggable={false}
        />
      )}
      </div>

      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm bg-white bg-opacity-20 px-4 py-2 rounded-lg">
        {isPdf ? 'Use browser PDF controls • Press Esc to close' : 'Pinch to zoom • Drag to pan • Press Esc to close'}
      </div>
    </div>
  );
}