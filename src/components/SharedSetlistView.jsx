import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Play, ListMusic, Target, Settings, X, Music2, ChevronLeft, ChevronRight } from 'lucide-react';

export default function SharedSetlistView() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [fontSize, setFontSize] = useState(18);
  const [highContrast, setHighContrast] = useState(false);

  // Fetch shared setlist
  useEffect(() => {
    async function fetchSharedSetlist() {
      try {
        // Get shared link
        const { data: shared, error: sharedError } = await supabase
          .from('shared_setlists')
          .select('event_id, permissions, expires_at')
          .eq('token', token)
          .single();

        if (sharedError || !shared) {
          setError('Link de compartición no válido o expirado');
          return;
        }

        // Check expiration
        if (shared.expires_at && new Date(shared.expires_at) < new Date()) {
          setError('Este link de compartición ha expirado');
          return;
        }

        // Get event with songs
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .select(`
            *,
            setlist_songs (
              sort_order,
              songs (*)
            )
          `)
          .eq('id', shared.event_id)
          .single();

        if (eventError) throw eventError;

        const orderedSongs = eventData.setlist_songs
          ?.sort((a, b) => a.sort_order - b.sort_order)
          .map(s => s.songs)
          .filter(Boolean) || [];

        setEvent(eventData);
        setSongs(orderedSongs);
      } catch (error) {
        console.error('Error loading shared setlist:', error);
        setError('Error al cargar el setlist compartido');
      } finally {
        setLoading(false);
      }
    }

    if (token) fetchSharedSetlist();
  }, [token]);

  const goToSong = (index) => {
    if (index >= 0 && index < songs.length) {
      setCurrentSongIndex(index);
    }
  };

  const nextSong = () => {
    if (currentSongIndex < songs.length - 1) {
      setCurrentSongIndex(prev => prev + 1);
    }
  };

  const prevSong = () => {
    if (currentSongIndex > 0) {
      setCurrentSongIndex(prev => prev - 1);
    }
  };

  const startPractice = () => {
    if (songs[currentSongIndex]) {
      navigate(`/practice/${songs[currentSongIndex].id}?fromShared=${token}&songIndex=${currentSongIndex}`);
    }
  };

  const currentSong = songs[currentSongIndex];

  if (loading) return <div className="h-screen bg-stage flex items-center justify-center text-white font-mono">Cargando setlist...</div>;
  if (error) return <div className="h-screen bg-stage flex items-center justify-center text-white font-mono p-4 text-center">{error}</div>;
  if (!event) return <div className="h-screen bg-stage flex items-center justify-center text-white font-mono">Setlist no encontrado.</div>;

  return (
    <div className={`h-screen flex flex-col bg-stage text-white overflow-hidden relative font-mono ${highContrast ? 'high-contrast' : ''}`} style={{ '--stage-font-size': `${fontSize}px` }}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-stage to-transparent z-20 flex flex-col md:flex-row md:items-center justify-between gap-3 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <button 
            onClick={() => navigate('/')}
            className="w-12 h-12 flex items-center justify-center bg-panel rounded-full text-white hover:text-amber-400 transition-colors shadow-lg"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="bg-panel px-4 py-2 rounded-full font-bold text-lg pointer-events-auto shadow-lg flex flex-col items-center min-w-[200px]">
            <div className="flex items-center gap-2 mb-1">
              <ListMusic size={20} className="text-blue-400" />
              <span className="text-blue-400 font-medium text-sm">Vista Compartida</span>
            </div>
            {event.title}
            <p className="text-xs text-gray-400">{songs.length} canciones</p>
          </div>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto md:order-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-12 h-12 flex items-center justify-center bg-panel rounded-full text-white hover:text-amber-400 transition-colors shadow-lg"
            title="Ajustes (Esc para cerrar)"
          >
            <Settings size={24} />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute top-28 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-panel rounded-2xl shadow-2xl border border-gray-700 p-4 z-30 pointer-events-auto animate-slide-down">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white">Ajustes de Vista</h3>
            <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-300">Tamaño fuente</span>
                <span className="text-white font-mono">{fontSize}px</span>
              </label>
              <input
                type="range"
                min="12"
                max="32"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full h-2 bg-gray-800 rounded-lg appearance-none accent-amber-400 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-300 truncate">Alto contraste</p>
                <p className="text-xs text-gray-500 truncate">Para escenarios con luces fuertes</p>
              </div>
              <button
                onClick={() => setHighContrast(!highContrast)}
                className={`relative w-16 h-9 rounded-full transition-colors flex-shrink-0 ${highContrast ? 'bg-amber-400' : 'bg-gray-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 transition-transform duration-200 ${highContrast ? 'translate-x-7' : 'translate-x-0'} w-8 h-8 bg-white rounded-full shadow-md`} />
              </button>
            </div>
          </div>
        </div>
      )}

      {!currentSong ? (
        /* Setlist Overview */
        <div className="flex-1 overflow-y-auto pt-28 pb-24 px-4 md:px-12 lg:px-24">
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Progress Summary */}
            <div className="bg-panel rounded-2xl p-6 border border-gray-800">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Target className="text-green-400" />
                Progreso del Setlist Compartido
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-gray-800 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-green-400">0</p>
                  <p className="text-xs text-gray-400">Practicadas</p>
                </div>
                <div className="bg-gray-800 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-white">1</p>
                  <p className="text-xs text-gray-400">Actual</p>
                </div>
                <div className="bg-gray-800 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-gray-400">{songs.length - 1}</p>
                  <p className="text-xs text-gray-400">Pendientes</p>
                </div>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 transition-all duration-500" style={{ width: '0%' }} />
              </div>
            </div>

            {/* Song List */}
            <div className="space-y-2">
              {songs.map((song, idx) => (
                <button
                  key={song.id}
                  onClick={() => goToSong(idx)}
                  disabled={idx > 0} // En vista compartida, se avanza en orden
                  className={`w-full text-left p-4 rounded-xl transition-all border-2 flex items-center gap-4 ${
                    idx === 0
                      ? 'bg-amber-900/30 border-amber-500 ring-2 ring-amber-500/20'
                      : 'bg-gray-800/50 border-gray-700 opacity-60'
                  }`}
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                    idx === 0 ? 'bg-amber-500' : 'bg-gray-700'
                  }">
                    {idx === 0 ? (
                      <Play size={24} className="text-white ml-1" />
                    ) : (
                      <Music2 size={24} className="text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate">{song.title}</p>
                    <p className="text-xs text-gray-400">{idx + 1} de {songs.length}</p>
                  </div>
                  {idx === 0 && (
                    <button
                      onClick={startPractice}
                      className="flex-shrink-0 px-6 py-2 bg-green-500 text-black rounded-xl font-bold hover:bg-green-600 transition-colors"
                    >
                      <Target size={16} className="mr-1" />
                      Practicar
                    </button>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Practicing Current Song - Redirect to PracticeView */
        <>
          <div className="flex-1 flex items-center justify-center pt-28">
            <div className="bg-panel rounded-2xl p-8 max-w-md w-full mx-4 border border-gray-800 text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <Play size={40} className="text-green-600 ml-2" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">{currentSong?.title}</h2>
              <p className="text-gray-400 mb-6">Canción {currentSongIndex + 1} de {songs.length}</p>
              <button
                onClick={startPractice}
                className="w-full py-4 bg-green-500 text-black rounded-xl font-bold text-lg hover:bg-green-600 transition-colors shadow-[0_0_15px_rgba(34,197,94,0.3)]"
              >
                <Target size={20} className="mr-2" />
                Abrir en Modo Práctica
              </button>
              <button
                onClick={() => { setCurrentSongIndex(0); }}
                className="w-full mt-4 py-3 bg-gray-800 text-white rounded-xl font-medium hover:bg-gray-700 transition-colors"
              >
                Volver al Setlist
              </button>
            </div>
          </div>
        </>
      )}

      {/* Bottom Navigation (only in overview mode) */}
      {!currentSong && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-panel p-4 rounded-3xl shadow-2xl border border-gray-800 z-20">
          <button
            onClick={prevSong}
            disabled={currentSongIndex === 0}
            className="w-12 h-12 flex items-center justify-center rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Canción anterior"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex flex-col items-center justify-center w-20 font-bold">
            <span className="text-xs text-gray-500 uppercase">Canción</span>
            <span className="text-white text-lg">{currentSongIndex + 1} / {songs.length}</span>
          </div>
          <button
            onClick={nextSong}
            disabled={currentSongIndex >= songs.length - 1}
            className="w-12 h-12 flex items-center justify-center rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Siguiente canción"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute top-28 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-panel rounded-2xl shadow-2xl border border-gray-700 p-4 z-30 pointer-events-auto animate-slide-down">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white">Ajustes de Vista</h3>
            <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-300">Tamaño fuente</span>
                <span className="text-white font-mono">{fontSize}px</span>
              </label>
              <input
                type="range"
                min="12"
                max="32"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full h-2 bg-gray-800 rounded-lg appearance-none accent-amber-400 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-300 truncate">Alto contraste</p>
                <p className="text-xs text-gray-500 truncate">Para escenarios con luces fuertes</p>
              </div>
              <button
                onClick={() => setHighContrast(!highContrast)}
                className={`relative w-16 h-9 rounded-full transition-colors flex-shrink-0 ${highContrast ? 'bg-amber-400' : 'bg-gray-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 transition-transform duration-200 ${highContrast ? 'translate-x-7' : 'translate-x-0'} w-8 h-8 bg-white rounded-full shadow-md`} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}