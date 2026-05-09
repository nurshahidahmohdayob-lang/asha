import React, { useState, useRef, useEffect } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, Crop as CropIcon, Check, Eraser, MousePointer2 } from 'lucide-react';

interface ImageEditorProps {
  imageUrl: string;
  onSave: (newUrl: string) => void;
  onCancel: () => void;
}

export const ImageEditor: React.FC<ImageEditorProps> = ({ imageUrl, onSave, onCancel }) => {
  const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl);
  const [hasError, setHasError] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const imgRef = useRef<HTMLImageElement>(null);
  const [mode, setMode] = useState<'crop' | 'transparency'>('crop');
  const [transparencyColor, setTransparencyColor] = useState<string | null>(null);
  const [tolerance, setTolerance] = useState(30);

  const getProxiedUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/') || url.includes('localhost')) {
      return url;
    }
    return `/api/proxy?url=${encodeURIComponent(url)}`;
  };

  // Sync currentImageUrl with prop if it changes
  useEffect(() => {
    setCurrentImageUrl(getProxiedUrl(imageUrl));
    setHasError(false);
  }, [imageUrl]);

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    setCrop(centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 90,
        },
        aspect || 1,
        width,
        height
      ),
      width,
      height
    ));
    setHasError(false);
  }

  const getCroppedImg = async () => {
    if (!imgRef.current || !completedCrop) return;

    try {
      const canvas = document.createElement('canvas');
      const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
      const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
      canvas.width = completedCrop.width * scaleX;
      canvas.height = completedCrop.height * scaleY;
      const ctx = canvas.getContext('2d');

      if (!ctx) return;

      ctx.drawImage(
        imgRef.current,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0,
        0,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY
      );

      return canvas.toDataURL('image/png');
    } catch (e) {
      console.error("CORS Error in crop", e);
      alert("This image is protected and cannot be edited. Try using a different image.");
      return null;
    }
  };

  const applyTransparency = async (color: { r: number, g: number, b: number }) => {
    if (!imgRef.current) return;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = imgRef.current.naturalWidth;
      canvas.height = imgRef.current.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(imgRef.current, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const distance = Math.sqrt(
          Math.pow(r - color.r, 2) +
          Math.pow(g - color.g, 2) +
          Math.pow(b - color.b, 2)
        );

        if (distance < tolerance) {
          data[i + 3] = 0; // Set alpha to 0
        }
      }

      ctx.putImageData(imageData, 0, 0);
      setCurrentImageUrl(canvas.toDataURL('image/png'));
    } catch (e) {
      console.error("CORS Error in transparency", e);
      alert("This image is protected and its background cannot be removed. Try uploading the image instead.");
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (mode !== 'transparency' || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * imgRef.current.naturalWidth;
    const y = ((e.clientY - rect.top) / rect.height) * imgRef.current.naturalHeight;

    const canvas = document.createElement('canvas');
    canvas.width = imgRef.current.naturalWidth;
    canvas.height = imgRef.current.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(imgRef.current, 0, 0);
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const color = { r: pixel[0], g: pixel[1], b: pixel[2] };
    
    applyTransparency(color);
  };

  const handleModeSwitch = async (newMode: 'crop' | 'transparency') => {
    if (mode === 'crop' && completedCrop && newMode === 'transparency') {
      // If switching from crop to transparency, apply the crop first
      const cropped = await getCroppedImg();
      if (cropped) {
        setCurrentImageUrl(cropped);
        setCompletedCrop(undefined);
      }
    }
    setMode(newMode);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 md:p-8">
      <div className="bg-white rounded-[2.5rem] max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white z-10 shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <h2 className="text-xl font-black text-[#064E3B] uppercase tracking-tight leading-none">Image Studio</h2>
              <span className="text-[10px] font-bold text-[#059669] uppercase tracking-widest mt-1">Professional Editor</span>
            </div>
            <div className="flex bg-[#F0FDF4] p-1.5 rounded-[1.25rem]">
              <button 
                onClick={() => handleModeSwitch('crop')}
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${mode === 'crop' ? 'bg-[#059669] text-white shadow-lg' : 'text-[#064E3B]/60 hover:bg-white'}`}
              >
                <CropIcon size={14} /> Crop Image
              </button>
              <button 
                onClick={() => handleModeSwitch('transparency')}
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${mode === 'transparency' ? 'bg-[#059669] text-white shadow-lg' : 'text-[#064E3B]/60 hover:bg-white'}`}
              >
                <Eraser size={14} /> Remove Background
              </button>
            </div>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-red-50 text-red-500 rounded-full transition-colors">
            <X size={28} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 md:p-12 bg-gray-50 flex items-center justify-center min-h-0 relative">
          {mode === 'crop' ? (
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={aspect}
              className="max-h-full"
            >
              <img
                ref={imgRef}
                alt="Crop me"
                src={currentImageUrl}
                onLoad={onImageLoad}
                onError={() => {
                  setHasError(true);
                }}
                style={{ maxHeight: 'calc(90vh - 250px)' }}
                className="object-contain select-none"
                crossOrigin="anonymous"
              />
            </ReactCrop>
          ) : (
            <div className="relative group cursor-crosshair max-h-full">
              <img
                ref={imgRef}
                alt="Transparency"
                src={currentImageUrl}
                onClick={handleCanvasClick}
                style={{ maxHeight: 'calc(90vh - 250px)' }}
                className="object-contain select-none shadow-xl rounded-2xl"
                crossOrigin="anonymous"
                onLoad={() => setHasError(false)}
                onError={() => setHasError(true)}
              />
              {!hasError && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-[#064E3B] text-white px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl border-2 border-white/20">
                  <MousePointer2 size={12} className="inline mr-2" /> Click background color to erase it
                </div>
              )}
            </div>
          )}

          {hasError && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center">
                <X size={40} />
              </div>
              <p className="text-sm font-black text-gray-900 uppercase">Could not load original image.</p>
              <button 
                onClick={onCancel}
                className="px-6 py-3 bg-[#059669] text-white rounded-xl font-bold text-xs uppercase"
              >
                Try Another Image
              </button>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            {mode === 'crop' ? (
              <div className="flex gap-2">
                {[undefined, 1, 16/9, 4/3, 3/4].map((a) => (
                  <button
                    key={a || 'free'}
                    onClick={() => {
                      setAspect(a);
                      if (imgRef.current && a) {
                        const { width, height } = imgRef.current;
                        setCrop(centerCrop(makeAspectCrop({ unit: '%', width: 90 }, a, width, height), width, height));
                      }
                    }}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${aspect === a ? 'border-[#059669] bg-[#F0FDF4] text-[#059669]' : 'border-gray-100 text-gray-400 hover:border-gray-200'}`}
                  >
                    {a === undefined ? 'Custom' : a === 1 ? '1:1 Square' : a === 16/9 ? '16:9 HD' : a === 4/3 ? '4:3 Standard' : '3:4 Mobile'}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-6 bg-gray-50 px-6 py-3 rounded-2xl border border-gray-100">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Eraser Sensitivity</span>
                </div>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" min="1" max="100" value={tolerance} 
                    onChange={(e) => setTolerance(parseInt(e.target.value))}
                    className="w-48 accent-[#059669] cursor-pointer"
                  />
                  <span className="text-xs font-black text-[#059669] tabular-nums">{tolerance}%</span>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={onCancel}
              className="px-8 py-4 bg-gray-100 text-gray-500 rounded-[1.25rem] font-black text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-all active:scale-95"
            >
              Discard Changes
            </button>
            <button
              disabled={hasError}
              onClick={async () => {
                if (mode === 'crop') {
                  const croppedImageUrl = await getCroppedImg();
                  if (croppedImageUrl) onSave(croppedImageUrl);
                } else {
                  onSave(currentImageUrl);
                }
              }}
              className="px-10 py-4 bg-[#059669] text-white rounded-[1.25rem] font-black text-[10px] uppercase tracking-widest hover:bg-[#047857] hover:shadow-xl transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <Check size={16} /> Finish & Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
