import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { parseLine, parseSections, isSectionMarker, getSectionName } from '../utils/musicLogic';
import { ArrowLeft, Minus, Plus, Play, Pause, RefreshCw, FileText, Contrast, Zap, SkipBack, SkipForward, Settings, X, ChevronUp, ChevronDown, Menu, Guitar } from 'lucide-react';

export default function StageViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [semitones, setSemitones] = useState(0);
  
  // Autoscroll state
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollRef = useRef(null);
  const animationRef = useRef(null);
  const lastTimeRef = useRef(null);

  // Attachment states
  const [mp3Url, setMp3Url] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);

  // Section markers
  const [sections, setSections] = useState([]);
  const [totalSections, setTotalSections] = useState(0);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);

  // Visual metronome
  const [showMetronome, setShowMetronome] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [timeSignature, setTimeSignature] = useState('4/4'); // '4/4', '3/4', '6/8', '2/4'
  const [metronomeSound, setMetronomeSound] = useState(false);
  const metronomeRef = useRef(null);
  const metronomeIntervalRef = useRef(null);
  const [metronomeFlash, setMetronomeFlash] = useState({ show: false, accent: false });
  const [currentBeat, setCurrentBeat] = useState(1);
  const audioContextRef = useRef(null);

  // High contrast mode
  const [highContrast, setHighContrast] = useState(false);

  // Font size
  const [fontSize, setFontSize] = useState(16); // base px

// Continuous setlist mode
  const [continuousMode, setContinuousMode] = useState(false);
  const [setlistSongs, setSetlistSongs] = useState([]);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);

// Settings panel
  const [showSettings, setShowSettings] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  // Bottom controls visibility (mobile responsive)
  const [showBottomControls, setShowBottomControls] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // LocalStorage persistence key
  const storageKey = `stage:${id}`;

  // Load persisted state
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const { semitones: savedSemitones, scrollTop, fontSize: savedFontSize, highContrast: savedContrast, showMetronome: savedMetronome, bpm: savedBpm, continuousMode: savedContinuous } = JSON.parse(saved);
        if (savedSemitones !== undefined) setSemitones(savedSemitones);
        if (savedFontSize !== undefined) setFontSize(savedFontSize);
        if (savedContrast !== undefined) setHighContrast(savedContrast);
        if (savedMetronome !== undefined) setShowMetronome(savedMetronome);
        if (savedBpm !== undefined) setBpm(savedBpm);
        if (savedContinuous !== undefined) setContinuousMode(savedContinuous);
        // Restore scroll position after content renders
        if (scrollTop !== undefined && scrollRef.current) {
          setTimeout(() => {
            scrollRef.current.scrollTop = scrollTop;
            accumScrollRef.current = scrollTop;
          }, 100);
        }
        // Don't auto-restore scrolling state for safety
      }
    } catch (e) {
      console.warn('Failed to load persisted state:', e);
    }
  }, [storageKey]);

  // Persist state
  useEffect(() => {
    if (song && scrollRef.current) {
      const state = {
        semitones,
        scrollTop: scrollRef.current.scrollTop,
        isScrolling,
        fontSize,
        highContrast,
        showMetronome,
        bpm,
        continuousMode,
      };
      localStorage.setItem(storageKey, JSON.stringify(state));
    }
  }, [semitones, fontSize, highContrast, showMetronome, bpm, continuousMode, isScrolling, song, storageKey]);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-collapse controls on mobile when scrolling starts
  useEffect(() => {
    if (isMobile && isScrolling) setShowBottomControls(false);
  }, [isScrolling, isMobile]);

  // Initialize from location state
  useEffect(() => {
    if (location.state?.setlist) {
      const setlist = location.state.setlist;
      setSetlistSongs(setlist);
      setContinuousMode(true);
      const currentIndex = setlist.findIndex(s => s.id === id);
      if (currentIndex >= 0) {
        setCurrentSongIndex(currentIndex);
      }
    }
  }, [location.state, id]);

  const prevSection = useCallback(() => {
    if (currentSectionIndex > 0) {
      const lineIndex = sections[currentSectionIndex - 1].lineIndex;
      const lineElements = scrollRef.current?.querySelectorAll('[data-line-index]');
      if (lineElements && lineElements[lineIndex]) {
        lineElements[lineIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
        setCurrentSectionIndex(currentSectionIndex - 1);
      }
    }
  }, [currentSectionIndex, sections]);

  const nextSection = useCallback(() => {
    if (currentSectionIndex < sections.length - 1) {
      const lineIndex = sections[currentSectionIndex + 1].lineIndex;
      const lineElements = scrollRef.current?.querySelectorAll('[data-line-index]');
      if (lineElements && lineElements[lineIndex]) {
        lineElements[lineIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
        setCurrentSectionIndex(currentSectionIndex + 1);
      }
    }
  }, [currentSectionIndex, sections]);

  useEffect(() => {
    async function fetchSong() {
      try {
        const { data, error } = await supabase
          .from('songs')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        setSong(data);

        const parsedSections = parseSections(data.content);
        setSections(parsedSections);
        setTotalSections(parsedSections.length);

        // Fetch attachment URLs if they exist
        if (data.mp3_url) {
          const { data: mp3Data } = supabase.storage.from('attachments').getPublicUrl(data.mp3_url);
          if (mp3Data) setMp3Url(mp3Data.publicUrl);
        }
        if (data.pdf_url) {
          const { data: pdfData } = supabase.storage.from('attachments').getPublicUrl(data.pdf_url);
          if (pdfData) setPdfUrl(pdfData.publicUrl);
        }
        
        // Update last practiced
        await supabase.from('songs').update({ last_practiced: new Date().toISOString() }).eq('id', id);
        
      } catch (error) {
        console.error('Error fetching song:', error);
      } finally {
        setLoading(false);
      }
    }
    
    if (id) fetchSong();
  }, [id, parseSections]);

  // stopAutoScroll must be defined before useEffect that uses it
  const stopAutoScroll = useCallback(() => {
    setIsScrolling(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    lastTimeRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopAutoScroll();
  }, [stopAutoScroll]);

  const accumScrollRef = useRef(0);

  // Refs for current values in scrollLoop (avoid stale closures)
  const songRef = useRef(null);
  const isScrollingRef = useRef(false);

  useEffect(() => { songRef.current = song; }, [song]);
  useEffect(() => { isScrollingRef.current = isScrolling; }, [isScrolling]);

  const scrollLoop = useCallback((time) => {
    if (!lastTimeRef.current) lastTimeRef.current = time;
    const deltaTime = time - lastTimeRef.current;
    
    // Use refs for current values
    const currentSong = songRef.current;
    const currentScrolling = isScrollingRef.current;
    const currentScrollRef = scrollRef.current;
    
    console.log('AutoScroll frame tick:', { deltaTime, isScrolling: currentScrolling, hasSong: !!currentSong, hasScrollRef: !!currentScrollRef });
    
    if (currentScrollRef && currentSong && currentScrolling) {
      const { scrollHeight, clientHeight } = currentScrollRef;
      const maxScroll = scrollHeight - clientHeight;
      
      if (maxScroll <= 0) {
        console.log('AutoScroll stopped: no scroll space', { scrollHeight, clientHeight, maxScroll });
        stopAutoScroll();
        return;
      }

      // RF2.2 Motor de Autoscroll Continuo calculado dinámicamente por la duración
      const durationMs = currentSong.duration_ms || 210000; 
      const speedPxPerMs = maxScroll / durationMs;
      
      const scrollAmount = speedPxPerMs * deltaTime;
      
      accumScrollRef.current += scrollAmount;
      const newScrollTop = Math.min(accumScrollRef.current, maxScroll);
      const beforeScroll = currentScrollRef.scrollTop;
      currentScrollRef.scrollTop = newScrollTop;
      const afterScroll = currentScrollRef.scrollTop;
      
      console.log('AutoScroll frame:', { 
        deltaTime, 
        speedPxPerMs, 
        scrollAmount, 
        accumScroll: accumScrollRef.current, 
        beforeScroll,
        afterScroll,
        maxScroll,
        durationMs
      });
      
      if (accumScrollRef.current >= maxScroll - 1) {
        console.log('AutoScroll completed');
        stopAutoScroll();
        
        // Continuous mode: auto-advance to next song
        if (continuousMode && setlistSongs.length > 0 && currentSongIndex < setlistSongs.length - 1) {
          setTimeout(() => {
            const nextSong = setlistSongs[currentSongIndex + 1];
            navigate(`/stage/${nextSong.id}`, { state: { setlist: setlistSongs } });
          }, 3000); // 3 second pause between songs
        }
        return;
      }
    }
    
    lastTimeRef.current = time;
    animationRef.current = requestAnimationFrame(scrollLoop);
  }, [continuousMode, currentSongIndex, setlistSongs, navigate, stopAutoScroll]);

  const startAutoScroll = useCallback(() => {
    if (scrollRef.current) {
      accumScrollRef.current = scrollRef.current.scrollTop;
      console.log('AutoScroll started:', { scrollTop: scrollRef.current.scrollTop, scrollHeight: scrollRef.current.scrollHeight, clientHeight: scrollRef.current.clientHeight });
    }
    setIsScrolling(true);
    lastTimeRef.current = performance.now();
    animationRef.current = requestAnimationFrame(scrollLoop);
  }, [scrollLoop]);

  const toggleScroll = useCallback(() => {
    if (isScrolling) {
      stopAutoScroll();
    } else {
      startAutoScroll();
    }
  }, [isScrolling, startAutoScroll, stopAutoScroll]);

  // Wake Lock API - prevent screen from turning off
  const wakeLockRef = useRef(null);
  
  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => {
          console.log('Wake Lock released');
        });
        console.log('Wake Lock activated');
      }
    } catch (err) {
      console.warn('Wake Lock failed:', err);
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  }, []);

  // Auto-request wake lock on mount (no fullscreen)
  useEffect(() => {
    requestWakeLock();
    
    return () => {
      releaseWakeLock();
    };
  }, [requestWakeLock, releaseWakeLock]);

  // Visual metronome effect with time signature and sound
  useEffect(() => {
    if (!showMetronome || !bpm) return;
    
    // Parse time signature (e.g., "4/4" -> beatsPerMeasure = 4)
    const [beatsPerMeasure] = timeSignature.split('/').map(Number);
    const intervalMs = 60000 / bpm;
    
    // Initialize audio context for sound
    const initAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
    };
    
    const playClick = (isAccent) => {
      if (!metronomeSound || !audioContextRef.current) return;
      
      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      // Accent beat (first beat) - higher pitch, louder
      osc.frequency.value = isAccent ? 1000 : 600;
      osc.type = 'sine';
      
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    };
    
    console.log('[DEBUG] Metronome started:', { bpm, timeSignature, intervalMs, sound: metronomeSound });
    
    let beatCount = 1;
    setCurrentBeat(1);
    
    metronomeIntervalRef.current = setInterval(() => {
      const isAccent = beatCount === 1;
      setCurrentBeat(beatCount);
      setMetronomeFlash({ show: true, accent: isAccent });
      
      if (metronomeSound) {
        initAudio();
        playClick(isAccent);
      }
      
      // Accent beat flashes longer (120ms), regular beats shorter (50ms)
      const flashDuration = isAccent ? 120 : 50;
      setTimeout(() => setMetronomeFlash({ show: false, accent: false }), flashDuration);
      
      beatCount = beatCount >= beatsPerMeasure ? 1 : beatCount + 1;
    }, intervalMs);
    
    return () => {
      if (metronomeIntervalRef.current) {
        clearInterval(metronomeIntervalRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [showMetronome, bpm, timeSignature, metronomeSound]);

  // High contrast effect
  useEffect(() => {
    if (highContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
    return () => document.documentElement.classList.remove('high-contrast');
  }, [highContrast]);

  // Font size effect
  useEffect(() => {
    document.documentElement.style.setProperty('--stage-font-size', `${fontSize}px`);
  }, [fontSize]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Space = play/pause scroll
      if (e.code === 'Space' && !e.target.matches('input, textarea')) {
        e.preventDefault();
        toggleScroll();
      }
      // Arrow keys for navigation
      if (e.code === 'ArrowRight' && continuousMode && currentSongIndex < setlistSongs.length - 1) {
        const nextSong = setlistSongs[currentSongIndex + 1];
        navigate(`/stage/${nextSong.id}`);
      }
      if (e.code === 'ArrowLeft' && continuousMode && currentSongIndex > 0) {
        const prevSong = setlistSongs[currentSongIndex - 1];
        navigate(`/stage/${prevSong.id}`);
      }
      // +/- for transpose
      if (e.code === 'Equal' || e.code === 'NumpadAdd') {
        e.preventDefault();
        setSemitones(s => s + 1);
      }
      if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        setSemitones(s => s - 1);
      }
      // Escape to close settings
      if (e.code === 'Escape') {
        setShowSettings(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [continuousMode, currentSongIndex, setlistSongs, navigate, toggleScroll]);

  // Calculate BPM from duration if not set
  useEffect(() => {
    if (song && song.duration_ms && !bpm) {
      setBpm(Math.round(120)); // default, could be calculated from time signature
    }
  }, [song, bpm]);

  if (loading) return <div className="h-screen bg-stage flex items-center justify-center text-white font-mono">Cargando...</div>;
  if (!song) return <div className="h-screen bg-stage flex items-center justify-center text-white font-mono">Canción no encontrada.</div>;

  const lines = song.content ? song.content.split('\n') : [];

  return (
    <div className={`h-screen flex flex-col bg-stage text-white overflow-hidden overflow-x-hidden relative font-mono ${highContrast ? 'high-contrast' : ''}`} style={{ '--stage-font-size': `${fontSize}px` }}>
      {/* Metronome visual indicator at very top */}
      {showMetronome && (
        <div 
          ref={metronomeRef}
          className="h-5 w-full bg-gray-900 metronome-bar border-b border-gray-700"
          style={{ backgroundColor: highContrast ? '#000' : '#0A0A0F' }}
        >
          <div className="h-full flex items-center justify-center px-2">
            {/* Beat grid - rectangles based on time signature */}
            <div className="flex items-center gap-1 w-full max-w-md mx-auto">
              {[...Array(parseInt(timeSignature.split('/')[0]) || 4)].map((_, i) => (
                <div 
                  key={i}
                  className="flex-1 h-4 relative min-w-0"
                >
                  <div 
                    className={`h-full rounded-sm transition-all duration-50 ${
                      i + 1 === currentBeat 
                        ? (metronomeFlash.show 
                            ? (metronomeFlash.accent 
                                ? 'bg-amber-200 shadow-[0_0_12px_rgba(251,191,36,1)] scale-y-140' 
                                : 'bg-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.9)] scale-y-130')
                            : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] scale-y-120')
                        : 'bg-gray-700'
                    }`}
                    style={{ transformOrigin: 'bottom center' }}
                  />
                  {/* Beat number */}
                  <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[8px] font-bold text-amber-300 whitespace-nowrap">
                    {i + 1}
                  </span>
                </div>
              ))}
            </div>
            
            {/* Prominent full-bar flash on accent */}
            {metronomeFlash.show && metronomeFlash.accent && (
              <div 
                className="absolute inset-0 bg-gradient-to-r from-amber-300/40 via-amber-200/20 to-amber-300/40 pointer-events-none animate-metronome-flash rounded-sm"
              />
            )}
          </div>
        </div>
      )}

      {/* Header flotante */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-stage to-transparent z-20 flex flex-col md:flex-row md:items-center justify-between gap-3 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <button 
            onClick={() => navigate('/')}
            className="w-12 h-12 flex items-center justify-center bg-panel rounded-full text-white hover:text-amber-400 transition-colors shadow-lg"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="bg-panel px-4 py-2 rounded-full font-bold text-lg pointer-events-auto shadow-lg flex flex-col items-center min-w-[200px]">
            {song.title}
            {/* Audio Player if mp3 exists */}
            {mp3Url && (
              <audio src={mp3Url} controls className="h-6 mt-2 max-w-[200px]" />
            )}
          </div>
</div>

        <div className="flex items-center gap-2 pointer-events-auto md:order-2">
          {pdfUrl && (
            <a 
              href={pdfUrl} 
              target="_blank" 
              rel="noreferrer"
              className="w-12 h-12 flex items-center justify-center bg-panel rounded-full text-white hover:text-amber-400 transition-colors shadow-lg"
              title="Abrir PDF"
            >
              <FileText size={24} />
            </a>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setShowSettingsModal(false)}>
          <div className="bg-panel rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-slide-down" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-700 sticky top-0 bg-panel z-10">
              <h3 className="font-bold text-white">Ajustes de Escenario</h3>
              <button onClick={() => setShowSettingsModal(false)} className="text-gray-400 hover:text-white"><X size={24} /></button>
            </div>
            <div className="p-4 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Font Size */}
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

              {/* High Contrast */}
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

              {/* Visual Metronome */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-300 truncate">Metrónomo</p>
                    <p className="text-xs text-gray-500 truncate">Pulso visual y sonido configurable</p>
                  </div>
                  <button
                    onClick={() => setShowMetronome(!showMetronome)}
                    className={`relative w-16 h-9 rounded-full transition-colors flex-shrink-0 ${showMetronome ? 'bg-amber-400' : 'bg-gray-700'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 transition-transform duration-200 ${showMetronome ? 'translate-x-7' : 'translate-x-0'} w-8 h-8 bg-white rounded-full shadow-md`} />
                  </button>
                </div>
                {showMetronome && (
                  <div className="space-y-4 mt-4">
                    {/* BPM */}
                    <div>
                      <label className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-300">BPM</span>
                        <span className="text-white font-mono">{bpm}</span>
                      </label>
                      <input
                        type="range"
                        min="40"
                        max="200"
                        value={bpm}
                        onChange={(e) => setBpm(Number(e.target.value))}
                        className="w-full h-2 bg-gray-800 rounded-lg appearance-none accent-amber-400 cursor-pointer"
                      />
                    </div>

                    {/* Time Signature */}
                    <div>
                      <label className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-300">Compás</span>
                        <span className="text-white font-mono">{timeSignature}</span>
                      </label>
                      <select
                        value={timeSignature}
                        onChange={(e) => setTimeSignature(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-amber-400"
                      >
                        <option value="4/4">4/4 (Cuatro por cuatro)</option>
                        <option value="3/4">3/4 (Vals)</option>
                        <option value="6/8">6/8 (Compuesto)</option>
                        <option value="2/4">2/4 (Marcha)</option>
                        <option value="5/4">5/4 (Irregular)</option>
                        <option value="7/8">7/8 (Irregular)</option>
                      </select>
                    </div>

                    {/* Sound Toggle */}
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-300">Sonido click</p>
                        <p className="text-xs text-gray-500">Click audible en cada pulso</p>
                      </div>
                      <button
                        onClick={() => setMetronomeSound(!metronomeSound)}
                        className={`relative w-16 h-9 rounded-full transition-colors flex-shrink-0 ${metronomeSound ? 'bg-amber-400' : 'bg-gray-700'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 transition-transform duration-200 ${metronomeSound ? 'translate-x-7' : 'translate-x-0'} w-8 h-8 bg-white rounded-full shadow-md`} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Continuous Mode */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-300 truncate">Modo setlist continuo</p>
                    <p className="text-xs text-gray-500 truncate">Auto-avanzar al terminar canción</p>
                  </div>
                  <button
                    onClick={() => setContinuousMode(!continuousMode)}
                    className={`relative w-16 h-9 rounded-full transition-colors flex-shrink-0 ${continuousMode ? 'bg-amber-400' : 'bg-gray-700'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 transition-transform duration-200 ${continuousMode ? 'translate-x-7' : 'translate-x-0'} w-8 h-8 bg-white rounded-full shadow-md`} />
                  </button>
                </div>
                {continuousMode && setlistSongs.length > 0 && (
                  <p className="text-xs text-amber-400 mt-2">Canción {currentSongIndex + 1} de {setlistSongs.length}</p>
                )}
              </div>

              {/* Transpose Controls in Settings */}
              <div className="pt-4 border-t border-gray-800">
                <p className="text-sm text-gray-300 mb-3">Transposición rápida</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSemitones(s => s - 1)} className="w-10 h-10 bg-gray-800 rounded-xl hover:bg-gray-700"><Minus size={20} /></button>
                  <span className={`w-16 text-center font-bold ${semitones !== 0 ? 'text-amber-400' : 'text-white'}`}>
                    {semitones > 0 ? `+${semitones}` : semitones}
                  </span>
                  <button onClick={() => setSemitones(s => s + 1)} className="w-10 h-10 bg-gray-800 rounded-xl hover:bg-gray-700"><Plus size={20} /></button>
                  <button onClick={() => setSemitones(0)} className="ml-2 w-10 h-10 bg-gray-800 rounded-xl hover:bg-gray-700 text-gray-400"><RefreshCw size={20} /></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contenido (con ref para scroll) */}
<div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto pt-24 md:pt-32 lg:pt-40 pb-28 md:pb-48 lg:pb-72 px-3 md:px-4 lg:px-6 safe-area-bottom"
        style={{ scrollBehavior: isScrolling ? 'auto' : 'smooth' }}
      >
        <div className="w-full mx-auto space-y-1 min-h-[calc(100vh+100px)] px-2 md:px-0">
          {lines.map((line, lineIndex) => {
            const parsed = parseLine(line, semitones);
            const isSection = isSectionMarker(line);
            const sectionName = isSection ? getSectionName(line) : null;
            
            // Skip empty lines that are just whitespace
            if (parsed.length === 1 && parsed[0].chord === '' && parsed[0].text.trim() === '') {
              return <div key={lineIndex} className="h-1" data-line-index={lineIndex}></div>;
            }
            
            // Filter out parts that are just whitespace (creates unwanted empty lines)
            const filteredParsed = parsed.filter(part => 
              part.chord || part.text.trim() !== ''
            );
            
            if (filteredParsed.length === 0) {
              return <div key={lineIndex} className="h-1" data-line-index={lineIndex}></div>;
            }
            
            // Section marker line - show as highlighted badge without braces
            if (isSection) {
              return (
                <div key={lineIndex} className="relative mb-2 leading-relaxed" data-line-index={lineIndex} style={{ lineHeight: '1.6', fontSize: 'var(--stage-font-size, 16px)' }}>
                  <div className="chord-line-mobile relative">
                    <span className="inline-flex items-center px-3 py-1.5 bg-amber-500/20 border border-amber-500/50 rounded-lg text-amber-300 font-bold uppercase tracking-wider" style={{ lineHeight: '1.6', fontSize: 'var(--stage-font-size, 16px)' }}>
                      {sectionName}
                    </span>
                  </div>
                </div>
              );
            }
            
            // Regular content line
            return (
              <div key={lineIndex} className={`relative mb-2 leading-relaxed`} data-line-index={lineIndex} style={{ lineHeight: '1.6', fontSize: 'var(--stage-font-size, 16px)' }}>
                <div className="chord-line-mobile relative">
                  {filteredParsed.map((part, partIndex) => (
                    <span key={partIndex} className="inline-flex items-baseline" style={{ lineHeight: '1.6' }}>
                      {/* Chord as inline element positioned above text using vertical-align */}
                      {part.chord && (
                        <span className="text-amber-400 font-bold align-top whitespace-nowrap chord-mobile" style={{ verticalAlign: 'top', lineHeight: '1', marginBottom: '-0.5em', fontSize: 'var(--stage-font-size, 16px)' }}>
                          {part.chord}
                        </span>
                      )}
                      <span className="whitespace-pre-wrap" style={{ lineHeight: '1.6' }}>
                        {part.text || '\u00A0'}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

{/* Controles Inferiores - Fixed/Static, Always Visible, Safe Area Aware */}
      <div className="fixed bottom-0 left-0 right-0 z-50 pb-safe pt-1 md:pt-2 px-2 md:px-4 lg:px-4">
        <div className="mx-auto max-w-[95vw] md:max-w-[80vw] lg:max-w-[70vw]">
          <div className="bg-panel/95 backdrop-blur-sm border border-gray-800 rounded-2xl md:rounded-3xl shadow-2xl p-2 md:p-3 lg:p-4 animate-slide-up">
            <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-3 lg:gap-4">
              {/* Transpose Controls - Always visible */}
              <div className="flex items-center gap-1 md:gap-2 bg-[#1A1A20] p-1 md:p-2 rounded-xl md:rounded-2xl flex-wrap justify-center flex-shrink-0">
                <button onClick={() => setSemitones(s => s - 1)} className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg hover:bg-gray-700 transition-colors" title="-1 Semitono"><Minus size={18} /></button>
                <div className="flex flex-col items-center justify-center w-9 md:w-12 font-bold">
                  <span className="text-[9px] md:text-xs text-gray-500 uppercase">Tono</span>
                  <span className={semitones !== 0 ? 'text-amber-400 text-sm md:text-base' : 'text-white text-sm md:text-base'}>{semitones > 0 ? `+${semitones}` : semitones}</span>
                </div>
                <button onClick={() => setSemitones(s => s + 1)} className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg hover:bg-gray-700 transition-colors" title="+1 Semitono"><Plus size={18} /></button>
                <button onClick={() => setSemitones(0)} className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg hover:bg-gray-700 transition-colors text-gray-400" title="Tono Original"><RefreshCw size={16} /></button>
              </div>

              <div className="w-px h-8 md:h-10 bg-gray-700 hidden md:block"></div>
              <div className="h-px w-8 bg-gray-700 md:hidden"></div>

              {/* Play/Pause - Main action, always centered */}
              <button
                onClick={toggleScroll}
                className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center transition-all flex-shrink-0 ${
                  isScrolling ? 'bg-red-500 text-white hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-amber-400 text-black hover:bg-amber-500 shadow-[0_0_15px_rgba(251,191,36,0.3)]'
                }`}
              >
                {isScrolling ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
              </button>

              <div className="w-px h-8 md:h-10 bg-gray-700 hidden md:block"></div>
              <div className="h-px w-8 bg-gray-700 md:hidden"></div>

              {/* Continuous mode navigation */}
              {continuousMode && setlistSongs.length > 0 && (
                <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                  <button onClick={() => currentSongIndex > 0 && navigate(`/stage/${setlistSongs[currentSongIndex - 1].id}`)} disabled={currentSongIndex === 0} className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center bg-[#1A1A20] rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Canción anterior"><SkipBack size={18} /></button>
                  <span className="text-[9px] md:text-xs font-mono text-gray-400 px-1 min-w-[2rem] text-center">{currentSongIndex + 1} / {setlistSongs.length}</span>
                  <button onClick={() => currentSongIndex < setlistSongs.length - 1 && navigate(`/stage/${setlistSongs[currentSongIndex + 1].id}`)} disabled={currentSongIndex === setlistSongs.length - 1} className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center bg-[#1A1A20] rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Siguiente canción"><SkipForward size={18} /></button>
                </div>
              )}

              <div className="w-px h-8 bg-gray-700 hidden md:block"></div>
              <div className="h-px w-8 bg-gray-700 md:hidden"></div>

              {/* Section Navigation */}
              {totalSections > 1 && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={prevSection} disabled={currentSectionIndex === 0} className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center bg-[#1A1A20] rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Sección anterior"><SkipBack size={18} /></button>
                  <span className="text-[9px] font-mono text-gray-400 px-1 min-w-[2rem] text-center">{currentSectionIndex + 1} / {totalSections}</span>
                  <button onClick={nextSection} disabled={currentSectionIndex >= totalSections - 1} className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center bg-[#1A1A20] rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Siguiente sección"><SkipForward size={18} /></button>
                </div>
              )}

              <div className="w-px h-8 bg-gray-700 hidden md:block"></div>
              <div className="h-px w-8 bg-gray-700 md:hidden"></div>

              {/* Quick toggles - Always visible */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => setShowMetronome(!showMetronome)} className={`w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg transition-colors ${showMetronome ? 'bg-amber-400 text-black' : 'bg-[#1A1A20] text-gray-400 hover:bg-gray-700'}`} title="Metrónomo visual"><Zap size={18} /></button>
                <button onClick={() => setHighContrast(!highContrast)} className={`w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg transition-colors ${highContrast ? 'bg-amber-400 text-black' : 'bg-[#1A1A20] text-gray-400 hover:bg-gray-700'}`} title="Alto contraste"><Contrast size={18} /></button>
                <button onClick={() => setShowSettingsModal(true)} className={`w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg transition-colors ${showSettingsModal ? 'bg-amber-400 text-black' : 'bg-[#1A1A20] text-gray-400 hover:bg-gray-700'}`} title="Ajustes"><Settings size={18} /></button>
              </div>
            </div>
</div>
        </div>
      </div>
    </div>
  );
};
