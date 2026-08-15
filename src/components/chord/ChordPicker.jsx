import { useState, useRef, useEffect } from 'react';
import { X, Music } from 'lucide-react';
import { CHORD_GROUPS, COMMON_CHORDS } from '../../utils/chordPickerData';

export function ChordPicker({ onInsertChord, triggerRef }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState('C');
  const pickerRef = useRef(null);
  const triggerButtonRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      // Don't close if clicking inside picker or on trigger button
      if (pickerRef.current && pickerRef.current.contains(e.target)) return;
      if (triggerButtonRef.current && triggerButtonRef.current.contains(e.target)) return;
      setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const insertChord = (chord) => {
    onInsertChord(chord);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={triggerButtonRef}>
      <button
        ref={(el) => { triggerButtonRef.current = el; }}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 text-xs font-medium text-white bg-amber-500/20 border border-amber-500/50 rounded-lg hover:bg-amber-500/30 transition-colors flex items-center gap-1"
        aria-label="Insertar acorde"
      >
        <Music size={12} /> Acordes
      </button>

      {isOpen && (
        <div
          ref={pickerRef}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute bottom-full left-0 mb-2 w-96 max-h-[400px] overflow-y-auto bg-panel border border-gray-700 rounded-xl shadow-xl p-3 z-50 animate-slide-up"
        >
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-800">
            <span className="text-xs font-medium text-gray-400">Insertar acorde</span>
            <button type="button" onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white"><X size={16} /></button>
          </div>

          {/* Root note tabs */}
          <div className="flex flex-wrap gap-1 mb-3 overflow-x-auto pb-2">
            {CHORD_GROUPS.map(({ root }) => (
              <button
                type="button"
                key={root}
                onClick={() => setActiveGroup(root)}
                onMouseDown={(e) => e.stopPropagation()}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  activeGroup === root
                    ? 'bg-amber-500 text-black font-bold'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                {root}
              </button>
            ))}
          </div>

          {/* Chords for active group */}
          <div className="flex flex-wrap gap-1">
            {CHORD_GROUPS.find(g => g.root === activeGroup)?.chords.map(chord => (
              <button
                type="button"
                key={chord}
                onClick={() => insertChord(chord)}
                onMouseDown={(e) => e.stopPropagation()}
                className="px-2 py-1 text-xs bg-gray-800 text-white rounded hover:bg-amber-500 hover:text-black transition-colors font-mono"
              >
                {chord}
              </button>
            ))}
          </div>

          {/* Quick common chords */}
          <div className="mt-4 pt-3 border-t border-gray-800">
            <p className="text-xs text-gray-500 mb-2">Comunes:</p>
            <div className="flex flex-wrap gap-1">
              {COMMON_CHORDS.map(chord => (
                <button
                  type="button"
                  key={chord}
                  onClick={() => insertChord(chord)}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="px-2 py-1 text-xs bg-gray-800 text-white rounded hover:bg-amber-500 hover:text-black transition-colors font-mono"
                >
                  {chord}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChordPicker;