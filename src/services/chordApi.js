// Chord API Service - Wrapper for external chord API
const API_BASE = 'https://api.chordpro.com'; // Replace with actual API URL

export async function fetchChords(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, value);
    }
  });
  
  const response = await fetch(`${API_BASE}/chords?${searchParams.toString()}`);
  if (!response.ok) throw new Error(`Error fetching chords: ${response.status}`);
  return response.json();
}

export async function fetchChordById(id) {
  const response = await fetch(`${API_BASE}/chords/${id}`);
  if (!response.ok) throw new Error(`Error fetching chord: ${response.status}`);
  return response.json();
}

export async function fetchNotes() {
  const response = await fetch(`${API_BASE}/notes`);
  if (!response.ok) throw new Error(`Error fetching notes: ${response.status}`);
  return response.json();
}

export async function fetchChordTypes() {
  const response = await fetch(`${API_BASE}/chord-types`);
  if (!response.ok) throw new Error(`Error fetching chord types: ${response.status}`);
  return response.json();
}

export async function fetchChordTypeById(id) {
  const response = await fetch(`${API_BASE}/chord-types/${id}`);
  if (!response.ok) throw new Error(`Error fetching chord type: ${response.status}`);
  return response.json();
}

// Helper: Search chords by note and type
export async function searchChords(note, type = null, limit = 20, page = 1) {
  return fetchChords({ note, type, limit, page });
}

// Helper: Get all chords for a specific note (all types)
export async function fetchChordsByNote(note) {
  return fetchChords({ note, limit: 100 });
}

// Helper: Get chords by type (major, minor, 7, maj7, etc.)
export async function fetchChordsByType(type, limit = 50) {
  return fetchChords({ type, limit });
}

// Local fallback data for offline/fallback
export const CHORD_TYPES = [
  'major', 'minor', '7', 'maj7', 'm7', 'dim', 'dim7', 'aug', 'sus2', 'sus4',
  '6', 'm6', '9', 'm9', 'add9', '11', 'm11', '13', 'm13', '7sus4', '7sus2',
  '7b5', '7#5', '7b9', '7#9', '7b13', 'dim9', 'maj9', 'maj11', 'maj13'
];

export const NOTES = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
  'Db', 'Eb', 'Gb', 'Ab', 'Bb'
];

// Generate all possible chord combinations locally
export function generateAllChords() {
  const chords = [];
  NOTES.forEach(note => {
    CHORD_TYPES.forEach(type => {
      chords.push({
        id: `${note}_${type}`,
        note,
        type,
        name: `${note}${type === 'major' ? '' : type}`,
        fullName: `${note} ${type === 'major' ? 'Major' : type}`
      });
    });
  });
  return chords;
}

export const ALL_CHORDS = generateAllChords();

// Search locally (no API needed)
export function searchChordsLocal(query) {
  const q = query.toLowerCase();
  return ALL_CHORDS.filter(c => 
    c.name.toLowerCase().includes(q) || 
    c.note.toLowerCase().includes(q) ||
    c.type.toLowerCase().includes(q)
  ).slice(0, 50);
}

// Get chord variations for a root note
export function getChordVariations(note) {
  return CHORD_TYPES.map(type => ({
    note,
    type,
    name: `${note}${type === 'major' ? '' : type}`,
    fullName: `${note} ${type === 'major' ? 'Major' : type}`
  }));
}

// Get related chords (circle of fifths)
export function getRelatedChords(note, type = 'major') {
  const circleOfFifths = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'];
  const idx = circleOfFifths.indexOf(note.replace('b', '').replace('#', ''));
  if (idx === -1) return [];
  
  const related = [
    circleOfFifths[(idx + 1) % 12], // V
    circleOfFifths[(idx - 1 + 12) % 12], // IV
    circleOfFifths[(idx + 2) % 12], // II
    circleOfFifths[(idx + 3) % 12], // VI
  ];
  
  return related.map(n => getChordVariations(n)).flat();
}