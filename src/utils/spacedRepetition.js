import { differenceInDays, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { parseSections, getSectionKey } from './songSections';

// 1=1 día, 2=3 días, 3=7 días, 4=15 días, 5=30 días
const MASTERY_INTERVALS = {
  1: 1,
  2: 3,
  3: 7,
  4: 15,
  5: 30
};

/**
 * Calculate retention based on section progress completion
 * Returns 0-100 based on how many sections are mastered
 * Uses ALL detected sections from song content, not just those with progress records
 */
export async function calculateRetentionFromProgress(songId, userId) {
  if (!songId || !userId) return 0;

  try {
    // Get song content to parse ALL sections
    const { data: songData, error: songError } = await supabase
      .from('songs')
      .select('content')
      .eq('id', songId)
      .single();

    if (songError || !songData) {
      console.error('Error fetching song for retention:', songError);
      return 0;
    }

    // Parse ALL sections from song content
    const allSections = parseSections(songData.content);
    const totalSections = allSections.length;

    if (totalSections === 0) {
      return 0; // No sections detected = 0% retention
    }

    // Get section progress for this song/user from DB
    const { data: progressData } = await supabase
      .from('song_section_progress')
      .select('section_name, section_order, is_completed')
      .eq('song_id', songId)
      .eq('user_id', userId);

    // Build progress map from DB
    const progressMap = {};
    if (progressData) {
      progressData.forEach(p => {
        const key = getSectionKey({ name: p.section_name }, p.section_order);
        progressMap[key] = p;
      });
    }

    // Count completed sections by checking each detected section against progress
    let completedSections = 0;

    allSections.forEach((section, index) => {
      const key = getSectionKey(section, index);
      const progress = progressMap[key];
      
      if (progress?.is_completed) {
        completedSections++;
      }
    });

    // Simple percentage: (completed / total) * 100
    const retention = Math.round((completedSections / totalSections) * 100);

    return Math.max(0, Math.min(100, retention));

  } catch (error) {
    console.error('Error calculating retention from progress:', error);
    return 0;
  }
}

/**
 * Synchronous fallback - returns 0 for new songs without practice data
 */
export function calculateRetentionSync(lastPracticed, masteryLevel, hasProgressData = false) {
  // If no practice history at all, return 0
  if (!lastPracticed || !masteryLevel || !hasProgressData) return 0;
  
  const lastPracticedDate = typeof lastPracticed === 'string' ? parseISO(lastPracticed) : lastPracticed;
  if (isNaN(lastPracticedDate.getTime())) return 0;

  const daysElapsed = differenceInDays(new Date(), lastPracticedDate);
  const targetInterval = MASTERY_INTERVALS[masteryLevel] || 1;
  
  if (daysElapsed <= 0) return 100;
  if (daysElapsed >= targetInterval * 2) return 0;
  
  const retention = 100 - (50 * (daysElapsed / targetInterval));
  return Math.max(0, Math.min(100, Math.round(retention)));
}

/**
 * Main async function - calculates retention from section progress
 * Falls back to time-based decay if no progress data
 */
export async function calculateRetention(lastPracticed, masteryLevel, songId, userId) {
  // Try progress-based calculation first (most accurate)
  if (songId && userId) {
    const progressRetention = await calculateRetentionFromProgress(songId, userId);
    if (progressRetention > 0) return progressRetention;
  }

  // Fallback: check if there are any practice sessions
  if (songId && userId) {
    try {
      const { data: sessions } = await supabase
        .from('practice_sessions')
        .select('started_at, sections_completed, total_sections, duration_seconds')
        .eq('song_id', songId)
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(1);

      if (sessions && sessions.length > 0) {
        // Has practice sessions but no section progress - use time decay
        return calculateRetentionSync(lastPracticed, masteryLevel, true);
      }
    } catch (error) {
      console.error('Error checking practice sessions:', error);
    }
  }

  // No practice data at all = 0% retention
  return 0;
}

export function getRetentionColor(retention) {
  if (retention >= 80) return 'text-green-500';
  if (retention >= 40) return 'text-amber-400';
  return 'text-red-500';
}