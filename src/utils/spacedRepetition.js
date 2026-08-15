import { differenceInDays, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';

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
 */
export async function calculateRetentionFromProgress(songId, userId) {
  if (!songId || !userId) return 0;

  try {
    // Get section progress for this song/user
    const { data: sections } = await supabase
      .from('song_section_progress')
      .select('is_completed, practice_count, last_practiced_at')
      .eq('song_id', songId)
      .eq('user_id', userId);

    if (!sections || sections.length === 0) {
      return 0; // No practice data = 0% retention
    }

    const totalSections = sections.length;
    const completedSections = sections.filter(s => s.is_completed).length;
    
    // Base retention from completion rate
    let retention = Math.round((completedSections / totalSections) * 100);

    // Bonus for recent practice (sections practiced in last 7 days)
    const recentPractice = sections.filter(s => {
      if (!s.last_practiced_at) return false;
      const daysAgo = differenceInDays(new Date(), parseISO(s.last_practiced_at));
      return daysAgo <= 7;
    }).length;
    
    const recentBonus = Math.min(20, Math.round((recentPractice / totalSections) * 20));
    retention = Math.min(100, retention + recentBonus);

    // Penalty for stale practice (no practice in 30+ days)
    const staleSections = sections.filter(s => {
      if (!s.last_practiced_at) return true; // Never practiced
      const daysAgo = differenceInDays(new Date(), parseISO(s.last_practiced_at));
      return daysAgo > 30;
    }).length;
    
    const stalePenalty = Math.round((staleSections / totalSections) * 30);
    retention = Math.max(0, retention - stalePenalty);

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