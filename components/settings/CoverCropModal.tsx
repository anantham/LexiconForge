import React, { useRef, useState, useEffect, useCallback } from 'react';

// Standard EPUB cover aspect ratio (2:3 portrait)
const COVER_ASPECT_RATIO = 2 / 3;
const OUTPUT_WIDTH = 600; // px - reasonable size for EPUB cover
const OUTPUT_HEIGHT = OUTPUT_WIDTH / COVER_ASPECT_RATIO;

interface CoverCropModalProps {
  imageUrl: string;
  onConfirm: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

export const CoverCropModal: React.FC<CoverCropModalProps> = ({
  imageUrl,
  onConfirm,
  onCancel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Image state
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Transform state
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Canvas dimensions (for display)
  const [canvasWidth, setCanvasWidth] = useState(300);
  const [canvasHeight, setCanvasHeight] = useState(450);

  // Load image
  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      setImg(image);
      setImgLoaded(true);

      // Calculate initial scale to fill the crop area
      const scaleX = canvasWidth / image.width;
      const scaleY = canvasHeight / image.height;
      const initialScale = Math.max(scaleX, scaleY);
      setScale(initialScale);

      // Center the image
      setOffsetX((canvasWidth - image.width * initialScale) / 2);
      setOffsetY((canvasHeight - image.height * initialScale) / 2);
    };
    image.src = imageUrl;
  }, [imageUrl, canvasWidth, canvasHeight]);

  // Set canvas dimensions based on container
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const containerWidth = Math.min(containerRef.current.clientWidth - 48, 400);
        const containerHeight = containerWidth / COVER_ASPECT_RATIO;
        setCanvasWidth(containerWidth);
        setCanvasHeight(containerHeight);
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Draw the image on canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw image with current transform
    ctx.save();
    ctx.drawImage(
      img,
      offsetX,
      offsetY,
      img.width * scale,
      img.height * scale
    );
    ctx.restore();
  }, [img, scale, offsetX, offsetY, canvasWidth, canvasHeight]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Mouse handlers for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offsetX, y: e.clientY - offsetY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffsetX(e.clientX - dragStart.x);
    setOffsetY(e.clientY - dragStart.y);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - offsetX, y: touch.clientY - offsetY });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setOffsetX(touch.clientX - dragStart.x);
    setOffsetY(touch.clientY - dragStart.y);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Wheel handler for zooming
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.max(0.1, Math.min(5, scale * zoomFactor));

    // Zoom towards center of canvas
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const newOffsetX = centerX - (centerX - offsetX) * (newScale / scale);
    const newOffsetY = centerY - (centerY - offsetY) * (newScale / scale);

    setScale(newScale);
    setOffsetX(newOffsetX);
    setOffsetY(newOffsetY);
  };

  // Zoom controls
  const handleZoomIn = () => {
    const newScale = Math.min(5, scale * 1.2);
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    setOffsetX(centerX - (centerX - offsetX) * (newScale / scale));
    setOffsetY(centerY - (centerY - offsetY) * (newScale / scale));
    setScale(newScale);
  };

  const handleZoomOut = () => {
    const newScale = Math.max(0.1, scale / 1.2);
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    setOffsetX(centerX - (centerX - offsetX) * (newScale / scale));
    setOffsetY(centerY - (centerY - offsetY) * (newScale / scale));
    setScale(newScale);
  };

  const handleFitToFill = () => {
    if (!img) return;
    const scaleX = canvasWidth / img.width;
    const scaleY = canvasHeight / img.height;
    const fillScale = Math.max(scaleX, scaleY);
    setScale(fillScale);
    setOffsetX((canvasWidth - img.width * fillScale) / 2);
    setOffsetY((canvasHeight - img.height * fillScale) / 2);
  };

  // Export cropped image
  const handleConfirm = () => {
    if (!img) return;

    // Create output canvas at final resolution
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = OUTPUT_WIDTH;
    outputCanvas.height = OUTPUT_HEIGHT;
    const ctx = outputCanvas.getContext('2d');
    if (!ctx) return;

    // Calculate the scale factor from display to output
    const displayToOutput = OUTPUT_WIDTH / canvasWidth;

    // Fill background
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

    // Draw image at output resolution
    ctx.drawImage(
      img,
      offsetX * displayToOutput,
      offsetY * displayToOutput,
      img.width * scale * displayToOutput,
      img.height * scale * displayToOutput
    );

    // Get data URL
    const dataUrl = outputCanvas.toDataURL('image/jpeg', 0.9);
    onConfirm(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/95 flex items-center justify-center p-4">
      <div
        ref={containerRef}
        className="bg-gray-800 rounded-xl max-w-lg w-full overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">
            Crop Cover Image
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Position your image for the EPUB cover (2:3 portrait)
          </p>
        </div>

        {/* Canvas area */}
        <div className="p-4 flex flex-col items-center">
          {!imgLoaded ? (
            <div
              className="flex items-center justify-center bg-gray-700 rounded-lg"
              style={{ width: canvasWidth, height: canvasHeight }}
            >
              <span className="text-gray-400 animate-pulse">Loading...</span>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              width={canvasWidth}
              height={canvasHeight}
              className="rounded-lg cursor-move border-2 border-dashed border-gray-600"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onWheel={handleWheel}
            />
          )}

          {/* Zoom controls */}
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={handleZoomOut}
              className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
              title="Zoom out"
            >
              −
            </button>
            <span className="text-gray-400 text-sm w-16 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
              title="Zoom in"
            >
              +
            </button>
            <button
              onClick={handleFitToFill}
              className="ml-2 px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors text-sm"
              title="Fit to fill"
            >
              Fit
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Drag to reposition • Scroll to zoom
          </p>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-700 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!imgLoaded}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Set as Cover
          </button>
        </div>
      </div>
    </div>
  );
};

export default CoverCropModal;
