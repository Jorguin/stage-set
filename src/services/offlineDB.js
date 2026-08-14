const DB_NAME = 'StageSetOfflineDB';
const DB_VERSION = 1;

const STORES = {
  SONGS: 'songs',
  EVENTS: 'events',
  SETLIST_SONGS: 'setlist_songs',
  PRACTICE_SESSIONS: 'practice_sessions',
  SECTION_PROGRESS: 'section_progress',
  PENDING_SYNC: 'pending_sync',
};

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Songs store
      if (!db.objectStoreNames.contains(STORES.SONGS)) {
        const songStore = db.createObjectStore(STORES.SONGS, { keyPath: 'id' });
        songStore.createIndex('band_id', 'band_id', { unique: false });
        songStore.createIndex('updated_at', 'updated_at', { unique: false });
      }

      // Events store
      if (!db.objectStoreNames.contains(STORES.EVENTS)) {
        const eventStore = db.createObjectStore(STORES.EVENTS, { keyPath: 'id' });
        eventStore.createIndex('band_id', 'band_id', { unique: false });
        eventStore.createIndex('date', 'date', { unique: false });
      }

      // Setlist songs store
      if (!db.objectStoreNames.contains(STORES.SETLIST_SONGS)) {
        const setlistStore = db.createObjectStore(STORES.SETLIST_SONGS, { keyPath: 'id' });
        setlistStore.createIndex('event_id', 'event_id', { unique: false });
        setlistStore.createIndex('song_id', 'song_id', { unique: false });
      }

      // Practice sessions store
      if (!db.objectStoreNames.contains(STORES.PRACTICE_SESSIONS)) {
        const practiceStore = db.createObjectStore(STORES.PRACTICE_SESSIONS, { keyPath: 'id' });
        practiceStore.createIndex('song_id', 'song_id', { unique: false });
        practiceStore.createIndex('user_id', 'user_id', { unique: false });
        practiceStore.createIndex('started_at', 'started_at', { unique: false });
      }

      // Section progress store
      if (!db.objectStoreNames.contains(STORES.SECTION_PROGRESS)) {
        const progressStore = db.createObjectStore(STORES.SECTION_PROGRESS, { keyPath: 'id' });
        progressStore.createIndex('song_id', 'song_id', { unique: false });
        progressStore.createIndex('user_id', 'user_id', { unique: false });
        progressStore.createIndex('song_user_section', ['song_id', 'user_id', 'section_name', 'section_order'], { unique: true });
      }

      // Pending sync store (for offline mutations)
      if (!db.objectStoreNames.contains(STORES.PENDING_SYNC)) {
        const syncStore = db.createObjectStore(STORES.PENDING_SYNC, { keyPath: 'id', autoIncrement: true });
        syncStore.createIndex('type', 'type', { unique: false });
        syncStore.createIndex('created_at', 'created_at', { unique: false });
      }
    };
  });
}

// Generic CRUD operations
export async function getAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getById(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getByIndex(storeName, indexName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function put(storeName, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put({ ...data, updated_at: new Date().toISOString() });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteById(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Offline sync queue
export async function queueForSync(type, payload) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.PENDING_SYNC, 'readwrite');
    const store = transaction.objectStore(STORES.PENDING_SYNC);
    const request = store.add({
      type,
      payload,
      created_at: new Date().toISOString(),
      retries: 0,
    });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingSync() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.PENDING_SYNC, 'readonly');
    const store = transaction.objectStore(STORES.PENDING_SYNC);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function removePendingSync(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.PENDING_SYNC, 'readwrite');
    const store = transaction.objectStore(STORES.PENDING_SYNC);
    const request = store.delete(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function incrementSyncRetry(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.PENDING_SYNC, 'readwrite');
    const store = transaction.objectStore(STORES.PENDING_SYNC);
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const item = getRequest.result;
      if (item) {
        item.retries = (item.retries || 0) + 1;
        const putRequest = store.put(item);
        putRequest.onsuccess = () => resolve(putRequest.result);
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve(null);
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

// Initialize from server (call on app start when online)
export async function initializeFromServer(supabase, userId) {
  try {
    // Fetch songs
    const { data: songs } = await supabase
      .from('songs')
      .select('*')
      .eq('user_id', userId); // Adjust based on your RLS

    if (songs) {
      for (const song of songs) {
        await put(STORES.SONGS, { ...song, _synced: true });
      }
    }

    // Fetch events
    const { data: events } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId);

    if (events) {
      for (const event of events) {
        await put(STORES.EVENTS, { ...event, _synced: true });
      }
    }

    // Fetch practice sessions
    const { data: sessions } = await supabase
      .from('practice_sessions')
      .select('*')
      .eq('user_id', userId);

    if (sessions) {
      for (const session of sessions) {
        await put(STORES.PRACTICE_SESSIONS, { ...session, _synced: true });
      }
    }

    // Fetch section progress
    const { data: progress } = await supabase
      .from('song_section_progress')
      .select('*')
      .eq('user_id', userId);

    if (progress) {
      for (const p of progress) {
        await put(STORES.SECTION_PROGRESS, { ...p, _synced: true });
      }
    }

    console.log('Offline DB initialized from server');
  } catch (error) {
    console.error('Failed to initialize offline DB:', error);
  }
}

// Sync pending changes to server
export async function syncToServer(supabase) {
  const pending = await getPendingSync();
  
  for (const item of pending) {
    try {
      const { type, payload } = item;
      
      let result;
      switch (type) {
        case 'create_practice_session':
          result = await supabase.from('practice_sessions').insert(payload).select().single();
          break;
        case 'update_practice_session':
          result = await supabase.from('practice_sessions').update(payload).eq('id', payload.id).select().single();
          break;
        case 'upsert_section_progress':
          result = await supabase.from('song_section_progress').upsert(payload, {
            onConflict: 'song_id,user_id,section_name,section_order'
          }).select().single();
          break;
        case 'update_section_progress':
          result = await supabase.from('song_section_progress').update(payload).eq('id', payload.id).select().single();
          break;
        case 'increment_mastery':
          await supabase.rpc('increment_mastery', { 
            p_song_id: payload.song_id, 
            p_user_id: payload.user_id 
          });
          result = { error: null };
          break;
        default:
          console.warn('Unknown sync type:', type);
          continue;
      }

      if (result?.error) {
        throw result.error;
      }

      // Remove from pending queue on success
      await removePendingSync(item.id);
      console.log(`Synced ${type} successfully`);
    } catch (error) {
      console.error(`Failed to sync ${item.type}:`, error);
      await incrementSyncRetry(item.id);
    }
  }
}

// Network status detection
export function setupNetworkListeners(supabase) {
  const handleOnline = () => {
    console.log('Back online, syncing...');
    syncToServer(supabase);
  };

  window.addEventListener('online', handleOnline);
  
  // Also sync periodically when online
  setInterval(() => {
    if (navigator.onLine) {
      syncToServer(supabase);
    }
  }, 30000); // Every 30 seconds

  return () => {
    window.removeEventListener('online', handleOnline);
  };
}

export { STORES };