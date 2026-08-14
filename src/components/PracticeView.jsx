import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { parseLine } from '../utils/musicLogic';
import { ArrowLeft, Minus, Plus, RefreshCw, Settings, X, CheckSquare, Target, ChevronLeft, ChevronRight } from 'lucide-react';

export default function PracticeView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [semitones, setSemitones] = useState(0);
  const [sections, setSections] = useState([]);
  const [sectionProgress, setSectionProgress] = useState({});
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [fontSize, setFontSize] = useState(18);
  const [highContrast, setHighContrast] = useState(false);

  const scrollRef = useRef(null);
  const practiceSessionRef = useRef(null);

  // Parse sections from song content
  const parseSections = useCallback((content) => {
    if (!content) return [];
    const lines = content.split('\n');
    const sections = [];
    const sectionNames = [
      'Intro', 'Verse', 'Chorus', 'Bridge', 'Outro', 'Pre-Chorus', 'Solo', 'Interlude', 'Tag', 'Ending',
      'Primera Parte', 'Segunda Parte', 'Tercera Parte', 'Cuarta Parte',
      'Pre-Estribillo', 'Estribillo', 'Pre-Coro', 'Coro',
      'Puente', 'Interludio', 'Final', 'Verso'
    ];
    const pattern = new RegExp(`^\\[(${sectionNames.join('|')})\\s*\\d*\\]`, 'i');
    lines.forEach((line, index) => {
      const match = line.match(pattern);
      if (match) {
        sections.push({
          name: match[1],
          lineIndex: index,
          originalLine: line
        });
      }
    });
    return sections;
  }, []);

  // Fetch song and section progress
  useEffect(() => {
    async function fetchData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: songData, error: songError } = await supabase
          .from('songs')
          .select('*')
          .eq('id', id)
          .single();

        if (songError) throw songError;
        setSong(songData);

        const parsedSections = parseSections(songData.content);
        setSections(parsedSections);

        // Fetch section progress
        const { data: progressData } = await supabase
          .from('song_section_progress')
          .select('*')
          .eq('song_id', id)
          .eq('user_id', user.id)
          .order('section_order');

        const progressMap = {};
        if (progressData) {
          progressData.forEach(p => {
            const key = `${p.section_name}-${p.section_order}`;
            progressMap[key] = p;
          });
        }
        setSectionProgress(progressMap);

        // Create practice session
        const { data: sessionData } = await supabase
          .from('practice_sessions')
          .insert({
            song_id: id,
            user_id: user.id,
            total_sections: parsedSections.length,
            sections_completed: parsedSections.filter(s => {
              const key = `${s.name}-${parsedSections.indexOf(s)}`;
              return progressMap[key]?.is_completed;
            }).length
          })
          .select()
          .single();

        if (sessionData) {
          practiceSessionRef.current = sessionData.id;
        }

      } catch (error) {
        console.error('Error fetching practice data:', error);
      } finally {
        setLoading(false);
      }
    }

    if (id) fetchData();
  }, [id, parseSections]);

  // Use ref for sectionProgress to avoid stale closure in useCallback
  const sectionProgressRef = useRef({});
  useEffect(() => { sectionProgressRef.current = sectionProgress; }, [sectionProgress]);

  // Toggle section completion
  const toggleSection = useCallback(async (section, sectionIndex) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const key = `${section.name}-${sectionIndex}`;
    const currentProgress = sectionProgressRef.current[key];
    const newCompleted = !currentProgress?.is_completed;

    try {
      if (newCompleted) {
        await supabase
          .from('song_section_progress')
          .upsert({
            song_id: id,
            user_id: user.id,
            section_name: section.name,
            section_order: sectionIndex,
            is_completed: true,
            completed_at: new Date().toISOString(),
            practice_count: (currentProgress?.practice_count || 0) + 1,
            last_practiced_at: new Date().toISOString()
          }, {
            onConflict: 'song_id,user_id,section_name,section_order'
          });
      } else {
        await supabase
          .from('song_section_progress')
          .update({ 
            is_completed: false, 
            completed_at: null,
            practice_count: (currentProgress?.practice_count || 1) - 1
          })
          .eq('song_id', id)
          .eq('user_id', user.id)
          .eq('section_name', section.name)
          .eq('section_order', sectionIndex);
      }

      setSectionProgress(prev => ({
        ...prev,
        [key]: {
          ...currentProgress,
          is_completed: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : null,
          practice_count: newCompleted ? (currentProgress?.practice_count || 0) + 1 : Math.max(0, (currentProgress?.practice_count || 1) - 1),
          last_practiced_at: newCompleted ? new Date().toISOString() : currentProgress?.last_practiced_at
        }
      }));

      // Update practice session
      if (practiceSessionRef.current) {
        const completedCount = Object.values(sectionProgressRef.current).filter(p => p.is_completed).length + (newCompleted ? 1 : -1);
        await supabase
          .from('practice_sessions')
          .update({ sections_completed: Math.max(0, completedCount) })
          .eq('id', practiceSessionRef.current);
      }

      // Check if all sections completed
      const allCompleted = Object.values({ ...sectionProgressRef.current, [key]: { is_completed: newCompleted } }).every(p => p.is_completed);
      if (allCompleted && sections.length > 0) {
        // Award mastery level up via database function
        await supabase.rpc('increment_mastery', { p_song_id: id, p_user_id: user.id });
      }

    } catch (error) {
      console.error('Error toggling section:', error);
    }
  }, [id, sections]);

  const goToSection = useCallback((index) => {
    if (index >= 0 && index < sections.length) {
      setActiveSectionIndex(index);
      if (scrollRef.current) {
        const lineElements = scrollRef.current.querySelectorAll('[data-line-index]');
        if (lineElements[sections[index].lineIndex]) {
          lineElements[sections[index].lineIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, [sections]);

  const nextSection = useCallback(() => goToSection(activeSectionIndex + 1), [goToSection, activeSectionIndex]);
  const prevSection = useCallback(() => goToSection(activeSectionIndex - 1), [goToSection, activeSectionIndex]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'ArrowRight') nextSection();
      if (e.code === 'ArrowLeft') prevSection();
      if (e.code === 'Space' && sections[activeSectionIndex]) toggleSection(sections[activeSectionIndex], activeSectionIndex);
      if (e.code === 'Escape') setShowSettings(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSectionIndex, sections, sectionProgress, nextSection, prevSection, toggleSection]);

  if (loading) return <div className="h-screen bg-stage flex items-center justify-center text-white font-mono">Cargando...</div>;
  if (!song) return <div className="h-screen bg-stage flex items-center justify-center text-white font-mono">Canción no encontrada.</div>;

  const lines = song.content ? song.content.split('\n') : [];

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
            <Target size={20} className="text-amber-400" />
            {song.title}
          </div>
        </div>

        {/* Section navigation */}
        {sections.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-center pointer-events-auto md:order-3 md:w-full md:justify-center">
            {sections.map((section, idx) => (
              <button
                key={idx}
                onClick={() => goToSection(idx)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${idx === activeSectionIndex 
                  ? 'bg-amber-400 text-black shadow-[0_0_10px_rgba(251,191,36,0.5)]' 
                  : sectionProgress[`${section.name}-${idx}`]?.is_completed
                    ? 'bg-green-500 text-white' 
                    : 'bg-panel text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                title={`Saltar a ${section.name}`}
              >
                {section.name.charAt(0)}
              </button>
            ))}
          </div>
        )}

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
            <h3 className="font-bold text-white">Ajustes de Práctica</h3>
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

            <div className="pt-4 border-t border-gray-800">
              <p className="text-sm text-gray-300 mb-3">Transposición</p>
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
      )}

      {/* Content */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto pt-32 md:pt-48 pb-64 px-4 md:px-12 lg:px-24"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="max-w-4xl mx-auto space-y-6 min-h-[calc(100vh+100px)]">
          {lines.map((line, lineIndex) => {
            const parsed = parseLine(line, semitones);
            
            if (parsed.length === 1 && parsed[0].chord === '' && parsed[0].text.trim() === '') {
              return <div key={lineIndex} className="h-6" data-line-index={lineIndex}></div>;
            }

            const isSection = sections.some(s => s.lineIndex === lineIndex);
            const sectionIndex = sections.findIndex(s => s.lineIndex === lineIndex);
            const progressKey = sectionIndex >= 0 ? `${sections[sectionIndex].name}-${sectionIndex}` : null;
            const isCompleted = progressKey ? sectionProgress[progressKey]?.is_completed : false;

            return (
              <div key={lineIndex} className={`flex flex-wrap relative mb-8 leading-relaxed ${isSection ? 'section-marker' : ''}`} data-line-index={lineIndex}>
                {isSection && (
                  <div className="absolute -left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 hidden md:block">
                    <div className={`w-3 h-3 rounded-full ${isCompleted ? 'bg-green-500' : 'bg-amber-400'}`} />
                    <span className="text-xs font-bold text-gray-400">{progressKey ? sectionProgress[progressKey]?.section_name : ''}</span>
                  </div>
                )}
                {parsed.map((part, partIndex) => (
                  <div key={partIndex} className="inline-flex flex-col relative mr-1 min-w-[0.5rem]">
                    {part.chord && (
                      <span className="text-amber-400 font-bold absolute -top-6 left-0 whitespace-nowrap text-lg">
                        {part.chord}
                      </span>
                    )}
                    <span className="text-xl whitespace-pre" style={{ fontSize: 'var(--stage-font-size, 18px)' }}>
                      {part.text || ' '}
                    </span>
                  </div>
                ))}
                {/* Section completion button at end of section */}
                {isSection && (
                  <button
                    onClick={() => toggleSection(sections[sectionIndex], sectionIndex)}
                    className="ml-4 flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium transition-all border-2 ${
                      isCompleted 
                        ? 'bg-green-500 text-white border-green-500' 
                        : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-amber-400'
                    }"
                  >
                    {isCompleted ? <CheckSquare size={16} /> : <CheckSquare size={16} className="text-gray-600" />}
                    <span>{isCompleted ? 'Completado' : 'Marcar'}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col md:flex-row items-center gap-4 bg-panel p-4 rounded-3xl shadow-2xl border border-gray-800 z-20">
        <div className="flex items-center gap-2 bg-[#1A1A20] p-1 rounded-2xl flex-wrap justify-center">
          <button onClick={prevSection} disabled={activeSectionIndex === 0} className="w-12 h-12 flex items-center justify-center rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-30" title="Sección anterior">
            <ChevronLeft size={24} />
          </button>
          <div className="flex flex-col items-center justify-center w-14 font-bold">
            <span className="text-xs text-gray-500 uppercase">Sección</span>
            <span className="text-white text-lg">{activeSectionIndex + 1} / {sections.length}</span>
          </div>
          <button onClick={nextSection} disabled={activeSectionIndex >= sections.length - 1} className="w-12 h-12 flex items-center justify-center rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-30" title="Siguiente sección">
            <ChevronRight size={24} />
          </button>
          <button onClick={() => setSemitones(0)} className="w-12 h-12 flex items-center justify-center rounded-xl hover:bg-gray-700 transition-colors text-gray-400" title="Tono Original">
            <RefreshCw size={20} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings(!showSettings)} className={`w-12 h-12 flex items-center justify-center rounded-xl transition-colors ${showSettings ? 'bg-amber-400 text-black' : 'bg-[#1A1A20] text-gray-400 hover:bg-gray-700'}`} title="Ajustes">
            <Settings size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}