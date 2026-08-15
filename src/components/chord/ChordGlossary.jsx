import { useState, useEffect, useCallback } from 'react';
import { Search, ChevronDown, ChevronUp, Guitar, Volume2, X, Copy } from 'lucide-react';
import { searchChordsLocal, getChordVariations, getRelatedChords, NOTES, CHORD_TYPES } from '../../services/chordApi';

export function ChordGlossary({ onSelectChord, onClose }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNote, setSelectedNote] = useState('C');
  const [selectedType, setSelectedType] = useState('major');
  const [activeTab, setActiveTab] = useState('search'); // 'search', 'byNote', 'related'
  const [results, setResults] = useState([]);
  const [selectedChord, setSelectedChord] = useState(null);
  const [showDiagram, setShowDiagram] = useState(false);

  // Local search
  useEffect(() => {
    if (activeTab === 'search') {
      setResults(searchChordsLocal(searchQuery));
    } else if (activeTab === 'byNote') {
      setResults(getChordVariations(selectedNote));
    } else if (activeTab === 'related' && selectedChord) {
      setResults(getRelatedChords(selectedChord.note, selectedChord.type));
    }
  }, [searchQuery, activeTab, selectedNote, selectedType, selectedChord]);

  const handleChordClick = (chord) => {
    setSelectedChord(chord);
    setShowDiagram(true);
    onSelectChord?.(chord);
  };

  const playChordSound = async (chord) => {
    // TODO: Implement audio playback using Web Audio API
    console.log('Play chord:', chord.name);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-panel">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Guitar size={24} className="text-amber-400" />
          Glosario de Acordes
        </h2>
        <button onClick={onClose} className="p-2 text-gray-400 hover:text-white">
          <X size={24} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 bg-panel px-4">
        {['search', 'byNote', 'related'].map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setSearchQuery(''); }}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-amber-400 text-amber-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab === 'search' && '🔍 Buscar'}
            {tab === 'byNote' && '🎵 Por Nota'}
            {tab === 'related' && '🔗 Relacionados'}
          </button>
        ))}
      </div>

      {/* Search/Filter Bar */}
      <div className="p-4 border-b border-gray-700 bg-panel/50">
        {activeTab === 'search' && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar acorde... (ej: C, Am7, F#m7b5)"
              className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
            />
          </div>
        )}

        {activeTab === 'byNote' && (
          <div className="flex flex-wrap gap-2">
            <select
              value={selectedNote}
              onChange={(e) => setSelectedNote(e.target.value)}
              className="flex-1 min-w-[120px] bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-400"
            >
              {NOTES.map(note => (
                <option key={note} value={note}>{note}</option>
              ))}
            </select>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="flex-1 min-w-[140px] bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-400"
            >
              <option value="major">Mayor</option>
              <option value="minor">Menor</option>
              <option value="7">7 (Dominante)</option>
              <option value="maj7">Maj7</option>
              <option value="m7">m7</option>
              <option value="dim">Disminuido</option>
              <option value="sus2">Sus2</option>
              <option value="sus4">Sus4</option>
            </select>
          </div>
        )}

        {activeTab === 'related' && !selectedChord && (
          <p className="text-center text-gray-500 py-8">Selecciona un acorde primero para ver relacionados</p>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {results.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <p className="text-lg">No se encontraron acordes</p>
            <p className="text-sm text-gray-600 mt-2">Intenta con otra búsqueda</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {results.map((chord) => (
              <button
                key={`${chord.note}_${chord.type}`}
                onClick={() => handleChordClick(chord)}
                className="bg-gray-800 hover:bg-gray-700 rounded-xl p-4 text-center transition-all hover:scale-105 active:scale-95 border border-gray-700"
              >
                <div className="font-bold text-white text-lg">{chord.name}</div>
                <div className="text-xs text-gray-400 mt-1">{chord.type === 'major' ? 'Mayor' : chord.type}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chord Detail Modal */}
      {showDiagram && selectedChord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4" onClick={() => setShowDiagram(false)}>
          <div className="bg-panel rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-slide-down" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-700 sticky top-0 bg-panel z-10">
              <div className="flex items-center gap-3">
                <div className="bg-amber-400 text-black px-3 py-1 rounded-lg font-bold text-lg">{selectedChord.name}</div>
                <span className="text-sm text-gray-400">{selectedChord.type === 'major' ? 'Mayor' : selectedChord.type}</span>
              </div>
              <button onClick={() => setShowDiagram(false)} className="text-gray-400 hover:text-white"><X size={24} /></button>
            </div>

            <div className="p-4 space-y-4">
              {/* Chord Diagram Placeholder */}
              <div className="bg-gray-900 rounded-xl p-6 text-center">
                <div className="text-gray-400 mb-2">Diagrama del Acorde</div>
                <div className="bg-gray-800 rounded-lg p-8 font-mono text-xs text-gray-400 text-left">
                  <pre>{getChordDiagram(selectedChord)}</pre>
                </div>
              </div>

              {/* Chord Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800 rounded-xl p-3">
                  <div className="text-xs text-gray-500">Nota raíz</div>
                  <div className="font-bold text-white text-lg">{selectedChord.note}</div>
                </div>
                <div className="bg-gray-800 rounded-xl p-3">
                  <div className="text-xs text-gray-500">Tipo</div>
                  <div className="font-bold text-white text-lg">{selectedChord.type === 'major' ? 'Mayor' : selectedChord.type}</div>
                </div>
              </div>

              {/* Related Chords */}
              <div>
                <h4 className="font-bold text-white mb-3">Acordes Relacionados</h4>
                <div className="flex flex-wrap gap-2">
                  {getRelatedChords(selectedChord.note, selectedChord.type).slice(0, 8).map(c => (
                    <button
                      key={`${c.note}_${c.type}`}
                      onClick={() => setSelectedChord(c)}
                      className="bg-gray-800 hover:bg-gray-700 rounded-lg px-3 py-2 text-sm text-white transition-colors"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    // TODO: Implement audio playback
                    console.log('Play chord:', selectedChord.name);
                  }}
                  className="flex-1 bg-amber-400 text-black py-3 rounded-xl font-bold hover:bg-amber-500 transition-colors flex items-center justify-center gap-2"
                >
                  <Volume2 size={20} /> Reproducir
                </button>
                <button
                  onClick={() => {
                    // Copy chord name to clipboard
                    navigator.clipboard.writeText(selectedChord.name);
                  }}
                  className="flex-1 bg-gray-800 text-white py-3 rounded-xl font-medium hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Copy size={20} /> Copiar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function getChordDiagram(chord) {
    // Simplified chord diagram - in production use a proper library
    const diagrams = {
      'C': 'e|---0---|\nB|---1---|\nG|---0---|\nD|---2---|\nA|---3---|\nE|-------|',
      'Am': 'e|---0---|\nB|---1---|\nG|---2---|\nD|---2---|\nA|---0---|\nE|-------|',
      'G': 'e|---3---|\nB|---0---|\nG|---0---|\nD|---0---|\nA|---2---|\nE|---3---|',
      'F': 'e|---1---|\nB|---1---|\nG|---2---|\nD|---3---|\nA|---3---|\nE|---1---|',
    };
    return diagrams[chord.note + (chord.type === 'major' ? '' : chord.type)] || 'Diagrama no disponible';
  }
}

export function ChordPicker({ onSelect, value, onChange }) {
  const [query, setQuery] = useState('');
  
  const results = useMemo(() => 
    searchChordsLocal(query).slice(0, 20), [query]);

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); onChange?.(e.target.value); }}
        placeholder="Escribe acorde... [C, Am7, F#m7b5]"
        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 font-mono"
        list="chord-suggestions"
      />
      <datalist id="chord-suggestions">
        {searchChordsLocal('').slice(0, 50).map(c => (
          <option key={`${c.note}_${c.type}`} value={c.name} />
        ))}
      </datalist>
      
      {query && (
        <div className="absolute z-10 mt-1 w-full bg-panel border border-gray-700 rounded-xl max-h-60 overflow-y-auto">
          {results.map(chord => (
            <button
              key={`${chord.note}_${chord.type}`}
              onClick={() => { onChange(chord.name); setQuery(chord.name); }}
              className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center gap-3"
            >
              <span className="font-bold text-amber-400 w-16">{chord.name}</span>
              <span className="text-xs text-gray-400">{chord.type === 'major' ? 'Mayor' : chord.type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}