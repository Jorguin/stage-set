import { useState, useEffect, useRef, useCallback } from 'react';
import { calculateSectionTimings } from '../services/chordProParser';

export function useSectionAutoScroll({
  parsedSong,
  bpm = 120,
  timeSignature = '4/4',
  onSectionChange,
  onComplete
}) {
  const [isScrolling, setIsScrolling] = useState(false);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [sectionProgress, setSectionProgress] = useState(0);
  const scrollRef = useRef(null);
  const animationRef = useRef(null);
  const startTimeRef = useRef(null);
  const sectionTimingsRef = useRef([]);

  useEffect(() => {
    if (parsedSong) {
      sectionTimingsRef.current = calculateSectionTimings(parsedSong, bpm, timeSignature);
    }
  }, [parsedSong, bpm, timeSignature]);

  const scrollToSection = useCallback((sectionIndex) => {
    if (!scrollRef.current || !parsedSong) return;
    
    const section = parsedSong.sections[sectionIndex];
    if (!section) return;

    const lineElements = scrollRef.current.querySelectorAll('[data-line-index]');
    const targetElement = lineElements[section.lineIndex];
    
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setCurrentSectionIndex(sectionIndex);
      onSectionChange?.(sectionIndex, section);
    }
  }, [parsedSong, onSectionChange]);

  const startAutoScroll = useCallback(() => {
    if (!parsedSong || sectionTimingsRef.current.length === 0) return;
    
    setIsScrolling(true);
    startTimeRef.current = performance.now();
    animateScroll();
  }, [parsedSong]);

  const stopAutoScroll = useCallback(() => {
    setIsScrolling(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  }, []);

  const toggleScroll = useCallback(() => {
    if (isScrolling) {
      stopAutoScroll();
    } else {
      startAutoScroll();
    }
  }, [isScrolling, startAutoScroll, stopAutoScroll]);

  const animateScroll = useCallback(() => {
    if (!isScrolling || !scrollRef.current) {
      return;
    }

    const now = performance.now();
    const elapsed = now - startTimeRef.current;
    const timings = sectionTimingsRef.current;
    
    if (timings.length === 0) return;

    let accumulatedTime = 0;
    let targetSectionIndex = 0;

    for (let i = 0; i < timings.length; i++) {
      accumulatedTime += timings[i].estimatedDurationMs;
      if (elapsed < accumulatedTime) {
        targetSectionIndex = i;
        break;
      }
    }

    if (targetSectionIndex >= timings.length) {
      setIsScrolling(false);
      onComplete?.();
      return;
    }

    const currentSection = timings[targetSectionIndex];
    const sectionStartTime = accumulatedTime - currentSection.estimatedDurationMs;
    const sectionProgress = Math.min(1, (elapsed - sectionStartTime) / currentSection.estimatedDurationMs);
    
    setCurrentSectionIndex(targetSectionIndex);
    setSectionProgress(sectionProgress);

    // Smooth scroll within section
    if (scrollRef.current) {
      const section = parsedSong.sections[targetSectionIndex];
      if (section) {
        const lineElements = scrollRef.current.querySelectorAll('[data-line-index]');
        const startElement = lineElements[section.lineIndex];
        const endLineIndex = timings[targetSectionIndex + 1] 
          ? parsedSong.sections[targetSectionIndex + 1].lineIndex - 1 
          : parsedSong.lines.length - 1;
        const endElement = lineElements[endLineIndex];

        if (startElement && endElement) {
          const startTop = startElement.offsetTop;
          const endTop = endElement.offsetTop + endElement.offsetHeight;
          const containerHeight = scrollRef.current.clientHeight;
          
          const targetScrollTop = startTop + (endTop - startTop - containerHeight) * sectionProgress;
          scrollRef.current.scrollTop = Math.max(0, targetScrollTop);
        }
      }
    }

    animationRef.current = requestAnimationFrame(animateScroll);
  }, [isScrolling, parsedSong]);

  const nextSection = useCallback(() => {
    if (currentSectionIndex < parsedSong.sections.length - 1) {
      scrollToSection(currentSectionIndex + 1);
    }
  }, [currentSectionIndex, parsedSong.sections.length, scrollToSection]);

  const prevSection = useCallback(() => {
    if (currentSectionIndex > 0) {
      scrollToSection(currentSectionIndex - 1);
    }
  }, [currentSectionIndex, scrollToSection]);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return {
    scrollRef,
    isScrolling,
    currentSectionIndex,
    sectionProgress,
    startAutoScroll,
    stopAutoScroll,
    toggleScroll,
    scrollToSection,
    nextSection,
    prevSection,
    totalSections: parsedSong?.sections.length || 0
  };
}

export function SectionProgressBar({ 
  currentSectionIndex, 
  totalSections, 
  sectionProgress,
  sections 
}) {
  if (totalSections === 0) return null;

  return (
    <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
      <div 
        className="h-full bg-amber-400 transition-all duration-300"
        style={{ 
          width: `${((currentSectionIndex + sectionProgress) / totalSections) * 100}%` 
        }}
      />
    </div>
  );
}

export function SectionJumpButtons({ 
  sections, 
  currentSectionIndex, 
  onJump,
  activeSection 
}) {
  if (!sections.length) return null;

  return (
    <div className="flex flex-wrap gap-1 justify-center">
      {sections.map((section, idx) => (
        <button
          key={idx}
          onClick={() => onJump(idx)}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
            idx === currentSectionIndex
              ? 'bg-amber-400 text-black shadow-[0_0_10px_rgba(251,191,36,0.5)]'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
          }`}
          title={`Saltar a ${section.name}`}
        >
          {section.name.charAt(0)}
          {idx === activeSection && <span className="ml-1">•</span>}
        </button>
      ))}
    </div>
  );
}