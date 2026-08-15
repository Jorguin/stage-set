// Shared section parsing logic - used by PracticeView, Dashboard, spacedRepetition

// English + Spanish section names - comprehensive list (longest first for regex priority)
const SECTION_NAMES = [
  'Primera Parte', 'Segunda Parte', 'Tercera Parte', 'Cuarta Parte',
  'Pre-Estribillo', 'PreEstribillo', 'Estribillo', 'Pre-Coro', 'PreCoro', 'Pre Coro', 'Coro',
  'Pre-Chorus', 'PreChorus', 'Pre Chorus', 'Chorus',
  'Verse', 'Bridge', 'Intro', 'Outro', 'Solo', 'Interlude', 'Tag', 'Ending',
  'Pre-Verse', 'PreVerse', 'Puente', 'Interludio', 'Final', 'Verso',
  'Refrain', 'Hook', 'Breakdown', 'Build', 'Drop', 'Vamp', 'Coda'
];

// Match section markers anywhere: [Verse], [Verse 1], [Segunda Parte], [Estribillo 2], etc.
// Allows optional space + word + optional digits: "Segunda Parte 1", "Chorus 2"
const SECTION_PATTERN = new RegExp(`\\[(${SECTION_NAMES.join('|')})(?:\\s+\\w+)?\\s*\\d*\\]`, 'i');

/**
 * Parse all sections from song content
 * Returns array of { name, lineIndex, originalLine, displayName }
 */
export function parseSections(content) {
  if (!content) return [];
  const lines = content.split('\n');
  const sections = [];
  
  lines.forEach((line, index) => {
    const match = line.match(SECTION_PATTERN);
    if (match) {
      // Create display name with index if multiple same-name sections
      const baseName = match[1];
      const existingSameName = sections.filter(s => s.name === baseName).length;
      const displayName = existingSameName > 0 ? `${baseName} ${existingSameName + 1}` : baseName;
      
      sections.push({
        name: baseName,
        displayName,
        lineIndex: index,
        originalLine: line
      });
    }
  });
  
  // DEBUG: Log parsed sections
  console.log('[parseSections] Parsed sections:', sections.map(s => `${s.displayName} (line ${s.lineIndex})`));
  
  return sections;
}

/**
 * Generate unique key for a section (used for progress tracking)
 */
export function getSectionKey(section, sectionIndex) {
  return `${section.name}-${sectionIndex}`;
}

/**
 * Get total sections count from song content (for retention calculation)
 */
export function getTotalSectionsFromContent(content) {
  return parseSections(content).length;
}