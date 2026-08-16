import { useState, useRef, useEffect } from 'react';
import { X, Music2 } from 'lucide-react';
import { SONG_PARTS, COMMON_PARTS } from '../../utils/songPartsData';

export function SongPartsPicker({ onInsertPart, triggerRef }) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef(null);
  const triggerButtonRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (pickerRef.current && pickerRef.current.contains(e.target)) return;
      if (triggerButtonRef.current && triggerButtonRef.current.contains(e.target)) return;
      setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const insertPart = (part) => {
    onInsertPart(part.tag);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={triggerButtonRef}>
      <button
        ref={(el) => { triggerButtonRef.current = el; }}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 text-xs font-medium text-white bg-amber-500/20 border border-amber-500/50 rounded-lg hover:bg-amber-500/30 transition-colors flex items-center gap-1"
        aria-label="Insertar parte de canción"
      >
        <Music2 size={12} /> Partes
      </button>

      {isOpen && (
        <div
          ref={pickerRef}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute bottom-full left-0 mb-2 w-64 max-h-[400px] overflow-y-auto bg-panel border border-gray-700 rounded-xl shadow-xl p-3 z-50 animate-slide-up"
        >
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-800">
            <span className="text-xs font-medium text-gray-400">Insertar parte</span>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white"><X size={16} /></button>
          </div>

          {/* Song parts */}
          <div className="flex flex-col gap-1 mb-3 max-h-[250px] overflow-y-auto">
            {SONG_PARTS.map(part => (
              <button
                type="button"
                key={part.id}
                onClick={() => insertPart(part)}
                onMouseDown={(e) => e.stopPropagation()}
                className="px-2 py-1.5 text-xs text-left bg-gray-800 text-white rounded hover:bg-amber-500 hover:text-black transition-colors font-mono"
              >
                {part.label}
              </button>
            ))}
          </div>

          {/* Quick common parts */}
          <div className="pt-3 border-t border-gray-800">
            <p className="text-xs text-gray-500 mb-2">Comunes:</p>
            <div className="flex flex-wrap gap-1">
              {COMMON_PARTS.map(part => (
                <button
                  type="button"
                  key={part.id}
                  onClick={() => insertPart(part)}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="px-2 py-1 text-xs bg-gray-800 text-white rounded hover:bg-amber-500 hover:text-black transition-colors font-mono"
                >
                  {part.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SongPartsPicker;