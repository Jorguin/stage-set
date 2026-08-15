import { useState, useRef, useEffect } from 'react';
import { X, Music } from 'lucide-react';

// Common chords organized by root note
const CHORD_GROUPS = [
  { root: 'C', chords: ['C', 'Cm', 'C7', 'Cmaj7', 'Cm7', 'Cdim', 'Csus2', 'Csus4', 'Cadd9', 'C/E', 'C/G'] },
  { root: 'C#', chords: ['C#', 'C#m', 'C#7', 'C#maj7', 'C#m7', 'C#dim', 'C#sus2', 'C#sus4', 'C#add9'] },
  { root: 'D', chords: ['D', 'Dm', 'D7', 'Dmaj7', 'Dm7', 'Ddim', 'Dsus2', 'Dsus4', 'Dadd9', 'D/F#', 'D/A'] },
  { root: 'D#', chords: ['D#', 'D#m', 'D#7', 'D#maj7', 'D#m7', 'D#dim', 'D#sus2', 'D#sus4', 'D#add9'] },
  { root: 'E', chords: ['E', 'Em', 'E7', 'Emaj7', 'Em7', 'Edim', 'Esus2', 'Esus4', 'Eadd9', 'E/G#', 'E/B'] },
  { root: 'F', chords: ['F', 'Fm', 'F7', 'Fmaj7', 'Fm7', 'Fdim', 'Fsus2', 'Fsus4', 'Fadd9', 'F/A', 'F/C'] },
  { root: 'F#', chords: ['F#', 'F#m', 'F#7', 'F#maj7', 'F#m7', 'F#dim', 'F#sus2', 'F#sus4', 'F#add9'] },
  { root: 'G', chords: ['G', 'Gm', 'G7', 'Gmaj7', 'Gm7', 'Gdim', 'Gsus2', 'Gsus4', 'Gadd9', 'G/B', 'G/D', 'G/F#'] },
  { root: 'G#', chords: ['G#', 'G#m', 'G#7', 'G#maj7', 'G#m7', 'G#dim', 'G#sus2', 'G#sus4', 'G#add9'] },
  { root: 'A', chords: ['A', 'Am', 'A7', 'Amaj7', 'Am7', 'Adim', 'Asus2', 'Asus4', 'Aadd9', 'A/C#', 'A/E'] },
  { root: 'A#', chords: ['A#', 'A#m', 'A#7', 'A#maj7', 'A#m7', 'A#dim', 'A#sus2', 'A#sus4', 'A#add9'] },
  { root: 'B', chords: ['B', 'Bm', 'B7', 'Bmaj7', 'Bm7', 'Bdim', 'Bsus2', 'Bsus4', 'Badd9', 'B/D#', 'B/F#'] },
];

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
              {['C', 'G', 'D', 'A', 'E', 'F', 'Am', 'Em', 'Dm', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m'].map(chord => (
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