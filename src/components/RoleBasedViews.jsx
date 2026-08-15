import { useState } from 'react';
import { renderChordProForRole } from '../services/chordProParser';

export const ROLES = [
  { id: 'guitar', label: 'Guitarra', icon: '🎸', desc: 'Acordes completos, diagramas, capo' },
  { id: 'bass', label: 'Bajo', icon: '🎸', desc: 'Notas raíz, walking bass, escalas' },
  { id: 'vocals', label: 'Voz/Coros', icon: '🎤', desc: 'Letra grande, entradas, armonías' },
  { id: 'drums', label: 'Batería', icon: '🥁', desc: 'Estructura, BPM, métrica, cues' },
  { id: 'keys', label: 'Teclados', icon: '🎹', desc: 'Acordes + voicings, patches' }
];

export function RoleSelector({ currentRole, onChange, compact = false }) {
  return (
    <div className={`flex items-center gap-1 ${compact ? 'flex-wrap' : ''}`}>
      {ROLES.map(role => (
        <button
          key={role.id}
          onClick={() => onChange(role.id)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
            currentRole === role.id
              ? 'bg-amber-400 text-black shadow-[0_0_10px_rgba(251,191,36,0.5)]'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
          }`}
          title={role.desc}
        >
          <span>{role.icon}</span>
          {!compact && <span>{role.label}</span>}
        </button>
      ))}
    </div>
  );
}

export function ChordDiagram({ chord, size = 'medium' }) {
  if (!chord) return null;
  
  const sizes = {
    small: { w: 40, h: 60, dot: 6 },
    medium: { w: 60, h: 90, dot: 8 },
    large: { w: 80, h: 120, dot: 10 }
  };
  
  const { w, h, dot } = sizes[size];
  
  // Simplified chord diagram - in production use a proper chord diagram library
  const diagrams = {
    'C': [[null, 1, 0, 2, 3, null]],
    'G': [[3, 2, 0, 0, 0, 3]],
    'D': [[null, null, 0, 2, 3, 2]],
    'A': [[null, 0, 2, 2, 2, 0]],
    'E': [[0, 2, 2, 1, 0, 0]],
    'Am': [[null, 0, 2, 2, 1, 0]],
    'Em': [[0, 2, 2, 0, 0, 0]],
    'Dm': [[null, null, 0, 2, 3, 1]],
    'F': [[1, 1, 2, 3, 3, 1]],
    'Bm': [[null, 2, 4, 4, 3, 2]],
  };
  
  const baseChord = chord.replace(/[#b].*/, '').replace(/m.*/, '').replace(/maj.*/, '').replace(/7.*/, '').replace(/sus.*/, '');
  const fingering = diagrams[baseChord] || [];
  
  return (
    <div className="inline-flex flex-col items-center gap-1">
      <div className="text-xs text-gray-400 mb-1">{chord}</div>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="bg-gray-900 rounded border border-gray-700">
        {/* Frets */}
        {[0, 1, 2, 3, 4].map(fret => (
          <line
            key={fret}
            x1={10} y1={10 + fret * 20}
            x2={w - 10} y2={10 + fret * 20}
            stroke="#374151" strokeWidth={fret === 0 ? 2 : 1}
          />
        ))}
        {/* Strings */}
        {[0, 1, 2, 3, 4, 5].map((str, i) => (
          <line
            key={str}
            x1={10 + i * 10} y1={10}
            x2={10 + i * 10} y2={h - 10}
            stroke="#374151" strokeWidth={1}
          />
        ))}
        {/* Dots */}
        {fingering[0]?.map((fret, stringIdx) => {
          if (fret === null) return null;
          return (
            <circle
              key={stringIdx}
              cx={10 + stringIdx * 10}
              cy={10 + (fret - 0.5) * 20}
              r={dot}
              fill="#fbbf24"
            />
          );
        })}
      </svg>
    </div>
  );
}

export function RoleBasedContent({ parsedSong, role, semitones = 0, fontSize = 16 }) {
  const filteredSong = renderChordProForRole(parsedSong, role);
  
  const transposeChord = (chord) => {
    if (semitones === 0) return chord;
    const SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const FLAT_TO_SHARP = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
    const match = chord.match(/^([A-G][#b]?)(.*)$/);
    if (!match) return chord;
    let [, root, suffix] = match;
    root = FLAT_TO_SHARP[root] || root;
    const rootIndex = SCALE.indexOf(root);
    if (rootIndex === -1) return chord;
    let newIndex = (rootIndex + semitones) % 12;
    if (newIndex < 0) newIndex += 12;
    return SCALE[newIndex] + suffix;
  };

  if (role === 'drums') {
    return (
      <div className="space-y-4" style={{ fontSize: `${fontSize}px` }}>
        {filteredSong.lines.map((line, idx) => (
          <div key={idx} className="flex items-center gap-4 py-2 border-b border-gray-800">
            {line.section && (
              <span className="w-24 text-xs font-bold text-amber-400 uppercase">
                {line.section}
              </span>
            )}
            <span className="text-gray-300">{line.text || '—'}</span>
          </div>
        ))}
      </div>
    );
  }

  if (role === 'vocals') {
    return (
      <div className="space-y-2 leading-relaxed" style={{ fontSize: `${fontSize * 1.2}px` }}>
        {filteredSong.lines.map((line, idx) => (
          <div key={idx} className="relative">
            {line.section && (
              <div className="text-xs font-bold text-amber-400 mb-1 uppercase">
                {line.section}
              </div>
            )}
            <p className="text-white whitespace-pre-wrap">{line.text}</p>
          </div>
        ))}
      </div>
    );
  }

  // Guitar, Bass, Keys - show chords + lyrics
  return (
    <div className="space-y-4" style={{ fontSize: `${fontSize}px` }}>
      {filteredSong.lines.map((line, idx) => {
        if (line.chords.length === 0 && !line.text.trim()) {
          return <div key={idx} className="h-4" />;
        }
        
        return (
          <div key={idx} className="relative">
            {line.section && (
              <div className="absolute -left-10 top-0 w-8 text-center text-xs font-bold text-amber-400">
                {line.section.charAt(0)}
              </div>
            )}
            <div className="flex flex-wrap items-baseline gap-1 leading-relaxed">
              {line.chords.map((chordObj, chordIdx) => (
                <span key={chordIdx} className="relative">
                  <span className="text-amber-400 font-bold absolute -top-6 left-0 whitespace-nowrap text-lg">
                    {transposeChord(chordObj.chord)}
                  </span>
                  {role === 'guitar' && chordObj.chord && (
                    <ChordDiagram chord={transposeChord(chordObj.chord)} size="small" />
                  )}
                  <span className="text-white ml-8" style={{ minWidth: '2rem' }}>
                    {chordIdx === line.chords.length - 1 ? line.text : ''}
                  </span>
                </span>
              ))}
              {line.chords.length === 0 && line.text && (
                <span className="text-gray-300">{line.text}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}