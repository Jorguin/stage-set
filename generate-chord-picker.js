// Generate ChordPicker groups from chords_database.json
// Run with: node generate-chord-picker.js

import fs from 'fs';

const db = JSON.parse(fs.readFileSync('D:/Descargas/chords_database.json', 'utf-8'));

// Map root note pitch class to preferred sharp name
const ROOT_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Collect all quality symbols per root
const qualityMap = new Map();

db.qualities.forEach(q => {
  const symbols = [q.canonical_symbol, ...q.aliases].filter(s => s && s.length > 0);
  
  // Add to all 12 roots
  for (let i = 0; i < 12; i++) {
    const root = ROOT_NAMES[i];
    if (!qualityMap.has(root)) qualityMap.set(root, new Set());
    symbols.forEach(s => qualityMap.get(root).add(s));
  }
});

// Also add slash chord bass notes
const BASS_NOTES = ROOT_NAMES.flatMap(r => [r, r + '/', r + '#', r + 'b']);

// Build CHORD_GROUPS
const CHORD_GROUPS = ROOT_NAMES.map(root => {
  const qualities = qualityMap.get(root) || new Set();
  // Add common slash chords
  const slash = ROOT_NAMES.map(b => `${root}/${b}`).filter(c => c !== root);
  const allChords = [...qualities, ...slash].filter(c => c && c.length > 0);
  
  // Sort: simple first, then by complexity
  allChords.sort((a, b) => {
    const score = (c) => {
      if (c === root) return -100; // root first
      if (c.startsWith(root + '/')) return 1000; // slash last
      if (c.includes('/')) return 100;
      if (c.length === 1) return -10;
      if (c.endsWith('m') || c.endsWith('M') || c === '7') return 0;
      return c.length;
    };
    return score(a) - score(b);
  });
  
  return { root, chords: allChords };
});

console.log('export const CHORD_GROUPS = ' + JSON.stringify(CHORD_GROUPS, null, 2) + ';');