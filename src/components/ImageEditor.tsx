import React, { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Move, Eraser, Check, Scissors } from 'lucide-react';
import { cn } from '../lib/utils';

interface ImageEditorProps {
  imageUrl: string;
  initialCrop?: { zoom: number, x: number, y: number };
  initialRemoveBackground?: boolean;
  onSave: (settings: { crop: { zoom: number, x: number, y: number }, removeBackground: boolean }) => void;
  onClose: () => void;
}

export const ImageEditor: React.FC<ImageEditorProps> = ({ 
  imageUrl, 
  initialCrop, 
  initialRemoveBackground, 
  onSave, 
  onClose 
}) => {
  const [zoom, setZoom] = useState(initialCrop?.zoom || 1.2);
  const [offsetX, setOffsetX] = useState(initialCrop?.x || 0);
  const [offsetY, setOffsetY] = useState(initialCrop?.y || 0);
  const [removeBG, setRemoveBG] = useState(initialRemoveBackground || false);
  const [isCapping, setIsCapping] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDrag = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isCapping) return;
    
    // Simple drag logic for offset
    const moveX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const moveY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    // This is a simplified version, real offset would need start positions
  };

  const saveSettings = () => {
    onSave({
      crop: { zoom, x: offsetX, y: offsetY },
      removeBackground: removeBG
    });
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col h-[80vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-[#FDFBF7]">
          <h2 className="text-xl font-black text-[#064E3B] flex items-center gap-2">
            <Scissors size={20} /> Image Studio
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Editor Area */}
        <div className="flex-1 relative bg-gray-100 overflow-hidden flex items-center justify-center p-8">
          <div 
            ref={containerRef}
            className="w-80 h-80 bg-white shadow-lg overflow-hidden relative cursor-move"
            onMouseDown={() => setIsCapping(true)}
            onMouseUp={() => setIsCapping(false)}
            onMouseLeave={() => setIsCapping(false)}
          >
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none border-2 border-dashed border-[#059669]/20 z-10" />
             <img 
               src={imageUrl} 
               alt="Editing"
               className={cn(
                 "max-w-none transition-all",
                 removeBG && "mix-blend-multiply brightness-110 contrast-125"
               )}
               style={{
                 width: `${zoom * 100}%`,
                 height: 'auto',
                 transform: `translate(${offsetX}px, ${offsetY}px)`,
               }}
             />
          </div>
          
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-full text-xs font-bold pointer-events-none">
             Drag image to position inside the frame
          </div>
        </div>

        {/* Controls */}
        <div className="p-6 bg-[#FDFBF7] space-y-6">
          <div className="flex items-center justify-between gap-8">
            <div className="flex-1 space-y-2">
              <label className="text-[10px] font-black uppercase text-[#064E3B]/40 flex items-center gap-2">
                <ZoomIn size={12} /> Zoom Level
              </label>
              <input 
                type="range" 
                min="1" 
                max="4" 
                step="0.1" 
                value={zoom} 
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full h-2 bg-[#D1FAE5] rounded-lg appearance-none cursor-pointer accent-[#059669]"
              />
            </div>

            <div className="w-px h-12 bg-[#D1FAE5]" />

            <div className="flex-1 space-y-2">
              <label className="text-[10px] font-black uppercase text-[#064E3B]/40 flex items-center gap-2">
                 Offset Balance
              </label>
              <div className="flex gap-4">
                 <div className="flex-1 space-y-1">
                   <input type="range" min="-200" max="200" value={offsetX} onChange={e => setOffsetX(parseInt(e.target.value))} className="w-full h-1 bg-[#D1FAE5] rounded-lg appearance-none cursor-pointer accent-[#059669]" />
                 </div>
                 <div className="flex-1 space-y-1">
                   <input type="range" min="-200" max="200" value={offsetY} onChange={e => setOffsetY(parseInt(e.target.value))} className="w-full h-1 bg-[#D1FAE5] rounded-lg appearance-none cursor-pointer accent-[#059669]" />
                 </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button 
              onClick={() => setRemoveBG(!removeBG)}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase text-xs transition-all border-2",
                removeBG 
                  ? "bg-[#059669] text-white border-[#059669] shadow-lg" 
                  : "bg-white text-[#059669] border-[#D1FAE5] hover:border-[#059669]"
              )}
            >
              <Eraser size={14} /> {removeBG ? "Background Filter On" : "Remove Background"}
            </button>

            <div className="flex gap-3">
              <button 
                onClick={onClose}
                className="px-6 py-3 bg-gray-100 text-[#2D3436] rounded-2xl font-black uppercase text-xs hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={saveSettings}
                className="px-8 py-3 bg-[#FFD93D] text-[#2D3436] border-2 border-black rounded-2xl font-black uppercase text-xs shadow-[4px_4px_0px_#000] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#000] active:translate-y-[2px] active:shadow-[2px_2px_0px_#000] transition-all flex items-center gap-2"
              >
                <Check size={16} /> Apply Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
