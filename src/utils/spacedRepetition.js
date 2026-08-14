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

// Synchronous version for render fallback
export function calculateRetentionSync(lastPracticed, masteryLevel) {
  if (!lastPracticed || !masteryLevel) return 0;
  
  const lastPracticedDate = typeof lastPracticed === 'string' ? parseISO(lastPracticed) : lastPracticed;
  
  if (isNaN(lastPracticedDate.getTime())) return 0;

  const daysElapsed = differenceInDays(new Date(), lastPracticedDate);
  const targetInterval = MASTERY_INTERVALS[masteryLevel] || 1;
  
  if (daysElapsed <= 0) return 100;
  if (daysElapsed >= targetInterval * 2) return 0;
  
  const retention = 100 - (50 * (daysElapsed / targetInterval));
  return Math.max(0, Math.min(100, Math.round(retention)));
}

// Async version with practice history
export async function calculateRetention(lastPracticed, masteryLevel, songId, userId) {
  // If no songId or userId, use simple calculation
  if (!songId || !userId) {
    return calculateRetentionSync(lastPracticed, masteryLevel);
  }

  try {
    // Fetch recent practice sessions for this song
    const { data: sessions } = await supabase
      .from('practice_sessions')
      .select('started_at, ended_at, sections_completed, total_sections, duration_seconds')
      .eq('song_id', songId)
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(10);

    if (!sessions || sessions.length === 0) {
      return calculateRetentionSync(lastPracticed, masteryLevel);
    }

    // Calculate weighted retention based on recent practice quality
    const now = new Date();
    let totalWeight = 0;
    let weightedRetention = 0;

    for (const session of sessions) {
      const sessionDate = parseISO(session.started_at);
      const daysAgo = differenceInDays(now, sessionDate);
      
      // Weight decreases exponentially with time (half-life of 7 days)
      const timeWeight = Math.exp(-daysAgo / 7);
      
      // Quality weight based on completion percentage
      const completionRate = session.total_sections > 0 
        ? session.sections_completed / session.total_sections 
        : 0;
      
      // Duration weight (capped at 1 hour = full weight)
      const durationWeight = Math.min(session.duration_seconds || 0, 3600) / 3600;
      
      const sessionWeight = timeWeight * (0.5 + 0.5 * completionRate) * (0.5 + 0.5 * durationWeight);
      
      // Retention for this session: starts at 100%, decays based on mastery interval
      const targetInterval = MASTERY_INTERVALS[masteryLevel] || 1;
      const sessionRetention = Math.max(0, 100 - (100 * daysAgo / (targetInterval * 2)));
      
      weightedRetention += sessionRetention * sessionWeight;
      totalWeight += sessionWeight;
    }

    if (totalWeight === 0) {
      return calculateRetentionSync(lastPracticed, masteryLevel);
    }

    const finalRetention = Math.round(weightedRetention / totalWeight);
    return Math.max(0, Math.min(100, finalRetention));

  } catch (error) {
    console.error('Error calculating retention:', error);
    return calculateRetentionSync(lastPracticed, masteryLevel);
  }
}

export function getRetentionColor(retention) {
  if (retention >= 80) return 'text-green-500';
  if (retention >= 40) return 'text-amber-400';
  return 'text-red-500';
}
