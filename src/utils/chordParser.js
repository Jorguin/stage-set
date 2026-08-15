/**
 * Auto-detect chords from plain text format and convert to ChordPro
 * 
 * Input format (plain text with chord line above lyrics):
 * C       G       Am       F
 * Amazing grace how sweet the sound
 * 
 * Output (ChordPro):
 * [C]Amazing [G]grace [Am]how [F]sweet the sound
 */

// Chord regex - matches valid chord symbols (including complex ones like B(add2), E/G#, C#m7, etc.)
const CHORD_REGEX = /^[A-G][#b]?(?:m(?:aj|in)?|maj|dim|aug|sus[0-9]*|add[0-9]*|[0-9]+)(?:\([^)]+\))?(?:\/[A-G][#b]?(?:m(?:aj|in)?|maj|dim|aug|sus[0-9]*|add[0-9]*|[0-9]+)?(?:\([^)]+\))?)?$/;

// Simpler fallback regex for basic chords
const SIMPLE_CHORD_REGEX = /^[A-G][#b]?(?:m|maj|min|dim|aug|sus|add|[0-9])?(?:\([^)]+\))?(?:\/[A-G][#b]?)?$/;

function isChord(token) {
  return CHORD_REGEX.test(token) || SIMPLE_CHORD_REGEX.test(token);
}

// Known section markers that should NOT be treated as chord lines
const SECTION_MARKERS = [
  'coro', 'chorus', 'verse', 'verso', 'bridge', 'puente', 'intro', 'outro',
  'pre-coro', 'precoro', 'pre-chorus', 'prechorus', 'interludio', 'interlude',
  'solo', 'tag', 'ending', 'final', 'coda', 'hook', 'refrain', 'breakdown',
  'build', 'drop', 'vamp', 'inter', 'inicio-coro', 'inicio coro'
];

// Check if a line is a section marker (e.g., "CORO:", "INTER:", "INICIO-CORO")
// Also extracts trailing chords if present: "INTER: E2 A2 C#m7 A"
function parseSectionLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  
  // Check for "MARKER: chords..." format
  const colonIndex = trimmed.indexOf(':');
  if (colonIndex > 0) {
    const marker = trimmed.substring(0, colonIndex).trim().toLowerCase();
    const afterColon = trimmed.substring(colonIndex + 1).trim();
    
    if (SECTION_MARKERS.some(m => marker === m || marker.startsWith(m + ' '))) {
      // Parse trailing chords if any
      const trailingChords = afterColon ? afterColon.split(/\s+/).filter(t => isChord(t)) : [];
      return { marker: trimmed.substring(0, colonIndex + 1), trailingChords, isMarker: true };
    }
  }
  
  // Check for plain marker (e.g., "CORO", "INTER", "INICIO-CORO")
  const lower = trimmed.toLowerCase();
  if (SECTION_MARKERS.some(m => lower === m || lower.startsWith(m + ' '))) {
    return { marker: trimmed, trailingChords: [], isMarker: true };
  }
  
  return null;
}

function isSectionMarker(line) {
  return parseSectionLine(line) !== null;
}

// Check if a line is primarily chords (no lyrics words)
// Tolerant: requires >= 70% chord tokens and at least 2 chords
export function isChordLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  
  // Skip section markers (but allow trailing chords on section lines - handled separately)
  if (isSectionMarker(trimmed)) return false;
  
  // Split by whitespace
  const tokens = trimmed.split(/\s+/).filter(t => t.length > 0);
  if (tokens.length < 2) return false; // Need at least 2 chords to be a chord line
  
  // Count chord tokens
  const chordTokens = tokens.filter(t => isChord(t));
  const chordRatio = chordTokens.length / tokens.length;
  
  // At least 70% chords AND at least 2 chord tokens
  return chordRatio >= 0.7 && chordTokens.length >= 2;
}

// Parse a chord line into array of {chord, column}
export function parseChordLine(line) {
  const chords = [];
  
  for (const match of line.matchAll(/\S+/g)) {
    const token = match[0];
    const startCol = match.index ?? 0;
    
    if (isChord(token)) {
      chords.push({ chord: token, column: startCol });
    }
  }
  
  return chords;
}

// Align chords to lyrics using word-based alignment (more robust than column positions)
export function alignChordsToLyrics(chords, lyricLine) {
  if (!chords.length || !lyricLine.trim()) return lyricLine;
  
  // Split lyric line into words with their positions
  const words = [];
  for (const match of lyricLine.matchAll(/\S+/g)) {
    words.push({ text: match[0], start: match.index ?? 0, end: (match.index ?? 0) + match[0].length });
  }
  
  if (!words.length) return lyricLine;
  
  let result = '';
  let wordIdx = 0;
  
  chords.forEach(({ chord, column }) => {
    // Find the word closest to this chord's column position
    while (wordIdx < words.length - 1 && words[wordIdx + 1].start <= column) {
      wordIdx++;
    }
    
    const targetWord = words[wordIdx];
    const insertPos = targetWord.start;
    
    // Add text up to this word
    result += lyricLine.substring(lastEnd, insertPos);
    result += `[${chord}]`;
    lastEnd = insertPos;
  });
  
  // Add remaining text
  result += lyricLine.substring(lastEnd);
  
  return result;
}

/**
 * Main function: convert plain text with chord lines to ChordPro format
 */
export function autoDetectChords(text) {
  if (!text) return text;
  
  const lines = text.split('\n');
  const result = [];
  
  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i];
    const nextLine = lines[i + 1];
    
    // Check for section line with trailing chords: "INTER: E2 A2 C#m7 A"
    const sectionInfo = parseSectionLine(currentLine);
    if (sectionInfo && sectionInfo.trailingChords.length > 0) {
      // Convert trailing chords to ChordPro format inline
      const chordStr = sectionInfo.trailingChords.map(c => `[${c}]`).join(' ');
      result.push(`${sectionInfo.marker} ${chordStr}`);
      continue;
    }
    
    // If current line is PURELY chords and next line exists (lyrics)
    if (isChordLine(currentLine) && nextLine !== undefined && !isSectionMarker(nextLine)) {
      const chords = parseChordLine(currentLine);
      const aligned = alignChordsToLyrics(chords, nextLine);
      result.push(aligned);
      i++; // Skip next line (we consumed it)
    } else {
      // Regular lyric line (or chord line without following lyrics)
      result.push(currentLine);
    }
  }
  
  return result.join('\n');
}

/**
 * Helper: try to detect if text is already in ChordPro format
 */
export function isAlreadyChordPro(text) {
  return /\[[A-G][#b]?(?:m|maj|min|dim|aug|sus|add|[0-9])?(?:\/[A-G][#b]?)?\]/.test(text);
}