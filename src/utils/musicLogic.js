const SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const FLAT_TO_SHARP = {
  'Db': 'C#',
  'Eb': 'D#',
  'Gb': 'F#',
  'Ab': 'G#',
  'Bb': 'A#'
};

// Mapea los bemoles a sostenidos
function normalizeNote(note) {
  return FLAT_TO_SHARP[note] || note;
}

// Extrae la raíz y el sufijo de un acorde (ej. "C#m7" -> raíz "C#", sufijo "m7")
function splitChord(chord) {
  const match = chord.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return { root: chord, suffix: '' }; // Si no hace match, devolvemos todo como raíz
  
  let root = match[1];
  let suffix = match[2];
  
  return { root: normalizeNote(root), suffix };
}

export function transposeChord(chord, semitones) {
  if (!chord) return chord;
  
  // Manejo de acordes con bajo alterno (ej. C/E)
  if (chord.includes('/')) {
    const parts = chord.split('/');
    return parts.map(part => transposeChord(part, semitones)).join('/');
  }

  const { root, suffix } = splitChord(chord);
  
  const rootIndex = SCALE.indexOf(root);
  if (rootIndex === -1) {
    // Si no es una nota válida, lo dejamos igual
    return chord;
  }
  
  // Calcular el nuevo índice, manejando números negativos y manteniéndolo entre 0-11
  let newIndex = (rootIndex + semitones) % 12;
  if (newIndex < 0) {
    newIndex += 12;
  }
  
  return SCALE[newIndex] + suffix;
}

export function parseLine(line, semitones = 0) {
  const regex = /\[(.*?)\]/g;
  let result = [];
  
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(line)) !== null) {
    // Texto antes del acorde
    if (match.index > lastIndex) {
      result.push({
        chord: '',
        text: line.substring(lastIndex, match.index)
      });
    }
    
    // El acorde
    const chordOriginal = match[1];
    const transposedChord = semitones !== 0 ? transposeChord(chordOriginal, semitones) : chordOriginal;
    
    // Necesitamos ver el texto inmediatamente después del acorde
    const nextBracketIndex = line.indexOf('[', regex.lastIndex);
    const endIndex = nextBracketIndex !== -1 ? nextBracketIndex : line.length;
    const textAfter = line.substring(regex.lastIndex, endIndex);
    
    result.push({
      chord: transposedChord,
      text: textAfter
    });
    
    lastIndex = endIndex;
  }
  
  // Si no hay acordes en absoluto, es solo texto
  if (result.length === 0 && line.trim().length > 0) {
    result.push({
      chord: '',
      text: line
    });
  }
  
  return result;
}
