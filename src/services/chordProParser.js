import { ChordSheet } from '@ftes/chordsheetjs';

export const CHORDPRO_METADATA_TAGS = [
  'title', 'artist', 'key', 'capo', 'tempo', 'time', 'timeSignature',
  'duration', 'book', 'number', 'flow', 'ccli', 'copyright', 'footer',
  'subtitle', 'composer', 'lyricist', 'arranger', 'transcriber'
];

export function parseChordPro(rawContent) {
  try {
    const chordSheet = new ChordSheet();
    chordSheet.load(rawContent);
    
    const metadata = {};
    CHORDPRO_METADATA_TAGS.forEach(tag => {
      const value = chordSheet.metadata[tag];
      if (value) metadata[tag] = value;
    });

    const lines = [];
    const sections = [];
    let currentSection = null;
    let lineIndex = 0;

    chordSheet.lyrics.forEach((lyricLine, idx) => {
      if (lyricLine.type === 'comment' && lyricLine.text.startsWith('section:')) {
        const sectionName = lyricLine.text.replace('section:', '').trim();
        currentSection = {
          name: sectionName,
          lineIndex: lines.length,
          originalLine: `[${sectionName}]`
        };
        sections.push(currentSection);
      } else if (lyricLine.type === 'lyric') {
        const chords = [];
        let text = '';
        
        if (lyricLine.chords && lyricLine.chords.length > 0) {
          lyricLine.chords.forEach((chord, chordIdx) => {
            if (chord) {
              chords.push({
                chord: chord.name,
                position: chord.position || chordIdx
              });
            }
          });
        }
        
        text = lyricLine.words || '';
        
        lines.push({
          type: 'lyric',
          chords,
          text,
          lineIndex,
          section: currentSection?.name || null
        });
        lineIndex++;
      } else if (lyricLine.type === 'comment') {
        lines.push({
          type: 'comment',
          text: lyricLine.text,
          lineIndex
        });
        lineIndex++;
      }
    });

    return {
      metadata,
      lines,
      sections,
      rawContent
    };
  } catch (error) {
    console.error('ChordPro parse error:', error);
    return fallbackParse(rawContent);
  }
}

function fallbackParse(rawContent) {
  const lines = rawContent.split('\n');
  const sections = [];
  const parsedLines = [];
  let lineIndex = 0;

  const sectionPattern = /^\[(Verse|Chorus|Bridge|Intro|Outro|Pre-Chorus|Solo|Interlude|Tag|Ending|Primera Parte|Segunda Parte|Tercera Parte|Cuarta Parte|Pre-Estribillo|Estribillo|Pre-Coro|Coro|Puente|Interludio|Final|Verso|Refrain|Hook|Breakdown|Build|Drop|Vamp|Coda)\s*\d*\]/i;

  lines.forEach((line, idx) => {
    const sectionMatch = line.match(sectionPattern);
    if (sectionMatch) {
      sections.push({
        name: sectionMatch[1],
        lineIndex: parsedLines.length,
        originalLine: line
      });
    }

    const chordPattern = /\[([A-G][#b]?(?:m|maj|min|dim|aug|sus|add)?\d*(?:\/[A-G][#b]?)?)\]/g;
    const chords = [];
    let cleanText = line;
    let match;

    while ((match = chordPattern.exec(line)) !== null) {
      chords.push({
        chord: match[1],
        position: match.index
      });
      cleanText = cleanText.replace(match[0], '');
    }

    parsedLines.push({
      type: chords.length > 0 ? 'lyric' : 'text',
      chords,
      text: cleanText.trim(),
      lineIndex: parsedLines.length
    });
  });

  return {
    metadata: {},
    lines: parsedLines,
    sections,
    rawContent
  };
}

export function transposeParsedSong(parsedSong, semitones) {
  if (semitones === 0) return parsedSong;

  const SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const FLAT_TO_SHARP = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };

  function transposeChord(chord) {
    if (!chord) return chord;
    if (chord.includes('/')) {
      return chord.split('/').map(transposeChord).join('/');
    }
    const match = chord.match(/^([A-G][#b]?)(.*)$/);
    if (!match) return chord;
    let [, root, suffix] = match;
    root = FLAT_TO_SHARP[root] || root;
    const rootIndex = SCALE.indexOf(root);
    if (rootIndex === -1) return chord;
    let newIndex = (rootIndex + semitones) % 12;
    if (newIndex < 0) newIndex += 12;
    return SCALE[newIndex] + suffix;
  }

  return {
    ...parsedSong,
    lines: parsedSong.lines.map(line => ({
      ...line,
      chords: line.chords.map(c => ({ ...c, chord: transposeChord(c.chord) }))
    }))
  };
}

export function renderChordProForRole(parsedSong, role = 'guitar') {
  const roleFilters = {
    guitar: line => line, // All chords, diagrams
    bass: line => ({
      ...line,
      chords: line.chords.map(c => ({
        ...c,
        chord: simplifyChordForBass(c.chord)
      }))
    }),
    vocals: line => ({
      ...line,
      chords: [], // Hide chords, show lyrics only
      text: line.text
    }),
    drums: line => ({
      ...line,
      chords: [],
      text: line.type === 'lyric' ? '' : line.text // Only structure
    })
  };

  const filter = roleFilters[role] || roleFilters.guitar;
  
  return {
    ...parsedSong,
    lines: parsedSong.lines.map(filter)
  };
}

function simplifyChordForBass(chord) {
  if (!chord) return chord;
  // Keep only root note for bass
  const match = chord.match(BASS_CHORD_REGEX);
  return match ? match[1] : chord;
}

const BASS_CHORD_REGEX = /^[A-G][#b]?/;

export function getSongStructure(parsedSong) {
  return parsedSong.sections.map((section, idx) => ({
    name: section.name,
    startLine: section.lineIndex,
    endLine: parsedSong.sections[idx + 1]?.lineIndex || parsedSong.lines.length,
    lineCount: (parsedSong.sections[idx + 1]?.lineIndex || parsedSong.lines.length) - section.lineIndex
  }));
}

export function calculateSectionTimings(parsedSong, bpm, timeSignature = '4/4') {
  const beatsPerMeasure = parseInt(timeSignature.split('/')[0]) || 4;
  const beatDurationMs = (60 / bpm) * 1000;
  const measureDurationMs = beatDurationMs * beatsPerMeasure;
  
  const structure = getSongStructure(parsedSong);
  
  return structure.map(section => ({
    ...section,
    estimatedMeasures: Math.max(1, Math.round(section.lineCount / 2)),
    estimatedDurationMs: Math.max(measureDurationMs, Math.round(section.lineCount / 2) * measureDurationMs)
  }));
}