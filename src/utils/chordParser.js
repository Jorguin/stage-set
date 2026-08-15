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

// Chord regex - matches valid chord symbols
const CHORD_REGEX = /^[A-G][#b]?(?:m|maj|min|dim|aug|sus|add|[0-9])?(?:\/[A-G][#b]?)?$/;

// Known section markers that should NOT be treated as chord lines
const SECTION_MARKERS = [
  'coro', 'chorus', 'verse', 'verso', 'bridge', 'puente', 'intro', 'outro',
  'pre-coro', 'precoro', 'pre-chorus', 'prechorus', 'interludio', 'interlude',
  'solo', 'tag', 'ending', 'final', 'coda', 'hook', 'refrain', 'breakdown',
  'build', 'drop', 'vamp', 'inter', 'inicio-coro', 'inicio coro'
];

// Check if a line is a section marker (e.g., "CORO:", "INTER:", "INICIO-CORO")
function isSectionMarker(line) {
  const trimmed = line.trim().toLowerCase();
  if (!trimmed) return false;
  // Lines ending with colon or matching known section names
  if (trimmed.endsWith(':')) return true;
  return SECTION_MARKERS.some(marker => trimmed === marker || trimmed.startsWith(marker + ' '));
}

// Check if a line is PURELY chords (no lyrics words)
export function isChordLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  
  // Skip section markers
  if (isSectionMarker(trimmed)) return false;
  
  // Split by whitespace and check if ALL tokens are chords
  const tokens = trimmed.split(/\s+/).filter(t => t.length > 0);
  if (tokens.length < 2) return false; // Need at least 2 chords to be a chord line
  
  // ALL tokens must be valid chords (not just 60%)
  const allChords = tokens.every(t => CHORD_REGEX.test(t));
  return allChords;
}

// Parse a chord line into array of {chord, column}
export function parseChordLine(line) {
  const chords = [];
  
  for (const match of line.matchAll(/\S+/g)) {
    const token = match[0];
    const startCol = match.index ?? 0;
    
    if (CHORD_REGEX.test(token)) {
      chords.push({ chord: token, column: startCol });
    }
  }
  
  return chords;
}

// Align chords to lyrics based on column positions
export function alignChordsToLyrics(chords, lyricLine) {
  if (!chords.length || !lyricLine.trim()) return lyricLine;
  
  let result = '';
  let lastEnd = 0;
  
  // Add chords before their aligned words
  chords.forEach(({ chord, column }) => {
    // Find the word in lyricLine at or near this column
    // We'll insert chord before the word that starts at/after this column
    const beforeText = lyricLine.substring(lastEnd, column);
    result += beforeText;
    result += `[${chord}]`;
    lastEnd = column;
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