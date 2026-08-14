import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { 
  initializeFromServer, 
  setupNetworkListeners, 
  syncToServer,
  getAll,
  getById,
  put,
  queueForSync,
  getPendingSync,
  getByIndex
} from '../services/offlineDB';

export function useOfflineDB() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initialize offline DB on first load
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await initializeFromServer(supabase, user.id);
          setInitialized(true);
          updatePendingCount();
        }
      } catch (error) {
        console.error('Failed to initialize offline DB:', error);
        setInitialized(true);
      }
    };
    init();
  }, [updatePendingCount]);

  // Setup network listeners for auto-sync
  useEffect(() => {
    if (!initialized) return;
    
    const cleanup = setupNetworkListeners(supabase);
    
    // Update pending count periodically
    const interval = setInterval(updatePendingCount, 5000);
    
    return () => {
      cleanup();
      clearInterval(interval);
    };
  }, [initialized, updatePendingCount]);

  const updatePendingCount = useCallback(async () => {
    try {
      const pending = await getPendingSync();
      setPendingCount(pending.length);
    } catch (error) {
      console.error('Failed to get pending count:', error);
    }
  }, []);

  // Wrapper functions for offline-first operations
  const getSongs = useCallback(async (bandId) => {
    const songs = await getAll('songs');
    return songs.filter(s => s.band_id === bandId);
  }, []);

  const getSong = useCallback(async (id) => {
    return getById('songs', id);
  }, []);

  const getEvents = useCallback(async (bandId) => {
    const events = await getAll('events');
    return events.filter(e => e.band_id === bandId);
  }, []);

  const getEvent = useCallback(async (id) => {
    return getById('events', id);
  }, []);

  const getPracticeSessions = useCallback(async (songId) => {
    return getByIndex('practice_sessions', 'song_id', songId);
  }, []);

  const getSectionProgress = useCallback(async (songId, userId) => {
    const progress = await getByIndex('section_progress', 'song_id', songId);
    return progress.filter(p => p.user_id === userId);
  }, []);

  const saveSong = useCallback(async (song, isOffline = !isOnline) => {
    await put('songs', song);
    if (isOffline) {
      await queueForSync('update_song', song);
    }
  }, [isOnline]);

  const saveEvent = useCallback(async (event, isOffline = !isOnline) => {
    await put('events', event);
    if (isOffline) {
      await queueForSync('update_event', event);
    }
  }, [isOnline]);

  const savePracticeSession = useCallback(async (session, isOffline = !isOnline) => {
    await put('practice_sessions', session);
    if (isOffline) {
      await queueForSync(session.id ? 'update_practice_session' : 'create_practice_session', session);
    }
  }, [isOnline]);

  const saveSectionProgress = useCallback(async (progress, isOffline = !isOnline) => {
    await put('section_progress', progress);
    if (isOffline) {
      await queueForSync(progress.id ? 'update_section_progress' : 'upsert_section_progress', progress);
    }
  }, [isOnline]);

  const triggerSync = useCallback(async () => {
    await syncToServer(supabase);
    updatePendingCount();
  }, [updatePendingCount]);

  return {
    isOnline,
    isInitialized: initialized,
    pendingCount,
    // Read operations
    getSongs,
    getSong,
    getEvents,
    getEvent,
    getPracticeSessions,
    getSectionProgress,
    // Write operations
    saveSong,
    saveEvent,
    savePracticeSession,
    saveSectionProgress,
    // Sync
    triggerSync,
    syncToServer: () => syncToServer(supabase),
  };
}