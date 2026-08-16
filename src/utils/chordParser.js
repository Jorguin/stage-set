/**
 * Auto-detect chords from plain text format and convert to ChordPro
 * 
 * Input format (plain text with chords anywhere):
 * C       G       Am       F
 * Amazing grace how sweet the sound
 * 
 * Output (ChordPro):
 * [C]Amazing [G]grace [Am]how [F]sweet the sound
 */
import { isChord } from './chordRegex.js';

/**
 * Main function: wrap chords found in text with [] brackets
 * Only detects chords that exist in the chord database (chordRegex)
 */
export function autoDetectChords(text) {
  if (!text) return text;
  
  // First check if already in ChordPro format
  if (isAlreadyChordPro(text)) return text;
  
  // Split into lines to preserve line structure
  const lines = text.split('\n');
  const result = [];
  
  for (const line of lines) {
    let processedLine = line;
    let lastEnd = 0;
    let resultLine = '';
    
    // Find all chord-like tokens in the line
    const tokenRegex = /\S+/g;
    const tokens = [];
    for (const match of line.matchAll(tokenRegex)) {
      tokens.push({
        token: match[0],
        start: match.index ?? 0,
        end: (match.index ?? 0) + match[0].length
      });
    }
    
    for (const { token, start, end } of tokens) {
      // Add text before this token
      resultLine += line.substring(lastEnd, start);
      
      // Check if this token is a valid chord
      if (isChord(token)) {
        resultLine += `[${token}]`;
      } else {
        resultLine += token;
      }
      
      lastEnd = end;
    }
    
    // Add remaining text
    resultLine += line.substring(lastEnd);
    result.push(resultLine);
  }
  
  return result.join('\n');
}

/**
 * Helper: try to detect if text is already in ChordPro format
 */
export function isAlreadyChordPro(text) {
  return /\[[A-G][#b]?(?:m|maj|min|dim|aug|sus|add|[0-9])?(?:\/[A-G][#b]?)?\]/.test(text);
}