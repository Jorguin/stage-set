// Auto-generated chord regex from chords_database.json
// DO NOT EDIT MANUALLY - run generate-chord-regex.js to update

/**
 * Builds a chord regex from the canonical chord database
 * Covers: root notes (A-G, #/b), all qualities with aliases, extensions, bass notes, parentheses
 */

// Root notes with accidentals
const ROOT_NOTES = ['A', 'A#', 'Bb', 'B', 'B#', 'Cb', 'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'E#', 'Fb', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab'];

// All chord quality symbols from database (canonical + aliases)
const QUALITY_SYMBOLS = [
  // Major
  '', 'maj', 'M', 'major',
  // Minor
  'm', 'min', '-', 'minor',
  // Augmented
  'aug', '+', '(#5)', 'aug5',
  // Diminished
  'dim', '°', 'dim3',
  // Suspended
  'sus2', 'sus4', 'sus', '(sus2)', '(sus4)',
  // Sixth
  '6', 'maj6', 'M6',
  'm6', 'min6', '-6',
  '6/9', '69', 'maj6/9', '6add9',
  // Added
  'add9', '(add9)', 'add2',
  'madd9', 'm(add9)', 'minadd9',
  // Seventh
  '7', 'dom7',
  'maj7', 'M7', 'Δ', 'Δ7', 'Maj7',
  'm7', 'min7', '-7',
  'm(maj7)', 'mM7', 'mΔ', 'min(maj7)',
  'm7b5', 'ø', 'ø7', 'm7(-5)', 'min7b5',
  'dim7', '°7',
  '7sus4', '7sus',
  '7#5', 'aug7', '7+',
  'maj7#5', 'M7#5', 'Δ#5',
  // Extended
  '9', 'dom9',
  'maj9', 'M9', 'Δ9',
  'm9', 'min9', '-9',
  '11', 'dom11',
  'maj11', 'M11', 'Δ11',
  'm11', 'min11', '-11',
  '13', 'dom13',
  'maj13', 'M13', 'Δ13',
  'm13', 'min13',
  // Altered
  '7b9', '7(-9)',
  '7#9', '7(+9)',
  '7#11', '7(+11)', '7b5',
  '7b13', '7(-13)',
  '7alt', 'alt',
  // Numeric extensions (standalone)
  '2', '4', '6', '7', '9', '11', '13',
];

// Sort by length descending to match longer patterns first
QUALITY_SYMBOLS.sort((a, b) => b.length - a.length);

// Escape for regex
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Build quality pattern (non-capturing group)
const QUALITY_PATTERN = '(?:' + QUALITY_SYMBOLS.map(escapeRegExp).join('|') + ')?';

// Root pattern (A-G with optional #/b)
const ROOT_PATTERN = '[A-G][#b]?';

// Extension pattern (after quality: 6, 7, 9, 11, 13, etc.)
const EXTENSION_PATTERN = '(?:[24679]|1[13])?';

// Parenthetical additions: (add9), (no3), (omit5), etc.
const PAREN_PATTERN = '(?:\\([^)]+\\))?';

// Bass/slash chord: /C, /C#, /Eb, etc.
const BASS_PATTERN = '(?:\\/[A-G][#b]?' + QUALITY_PATTERN + EXTENSION_PATTERN + PAREN_PATTERN + ')?';

// Full chord regex
export const CHORD_REGEX = new RegExp(
  '^' + ROOT_PATTERN + QUALITY_PATTERN + EXTENSION_PATTERN + PAREN_PATTERN + BASS_PATTERN + '$'
);

// Simpler fallback for basic chords (covers 95% of cases)
export const SIMPLE_CHORD_REGEX = /^[A-G][#b]?(?:m|mi|min|maj|M|dim|°|aug|\+|sus[24]?|add[249]?|[24679]|1[13])?(?:\([^)]+\))?(?:\/[A-G][#b]?(?:m|mi|min|maj|M|dim|°|aug|\+|sus[24]?|add[249]?|[24679]|1[13])?(?:\([^)]+\))?)?$/;

export function isChord(token) {
  return CHORD_REGEX.test(token) || SIMPLE_CHORD_REGEX.test(token);
}

// For debugging
export function getChordRegex() {
  return CHORD_REGEX;
}