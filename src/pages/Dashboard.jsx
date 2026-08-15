import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { calculateRetentionFromProgress } from '../utils/spacedRepetition';
import { parseSections, getSectionKey } from '../utils/songSections';
import { LogOut, Play, Plus, Calendar, Folder, Mic2, MapPin, CheckSquare, Square, Trash2, Music2, Users, Settings, X, ChevronDown, Save, Edit, Brain, Target, GripVertical, Share2 } from 'lucide-react';

export default function Dashboard() {
  const [bands, setBands] = useState([]);
  const [activeBandId, setActiveBandId] = useState(null);
  
  const [activeTab, setActiveTab] = useState('songs'); // 'songs' | 'events' | 'practice'
  
  const [songs, setSongs] = useState([]);
  const [events, setEvents] = useState([]);
  const [sharedEvents, setSharedEvents] = useState([]);
  const [practiceSongs, setPracticeSongs] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [isSongModalOpen, setIsSongModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isBandModalOpen, setIsBandModalOpen] = useState(false);
  const [editingBandId, setEditingBandId] = useState(null);
  const [editBandName, setEditBandName] = useState('');
  const [newBandName, setNewBandName] = useState('');
  const navigate = useNavigate();

  // Song form states
  const [newSongTitle, setNewSongTitle] = useState('');
  const [newSongContent, setNewSongContent] = useState('');
  const [newSongDuration, setNewSongDuration] = useState('03:30'); // MM:SS
  const [mp3File, setMp3File] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Event form states
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [selectedSongIds, setSelectedSongIds] = useState([]);

// Delete confirmation states
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type: 'song'|'event'|'band'|'attachment', id, name, songId? }
  const [openSongMenu, setOpenSongMenu] = useState(null);
  const [editingSong, setEditingSong] = useState(null);
  const [retentionMap, setRetentionMap] = useState({});

  // Drag and drop for setlist reordering
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  useEffect(() => {
    fetchData();
    fetchSharedEvents();
  }, []);

  useEffect(() => {
    if (activeBandId) {
      if (activeTab === 'songs') fetchSongs(activeBandId);
      else if (activeTab === 'events') {
        fetchSongs(activeBandId);
        fetchEvents(activeBandId);
      }
      else if (activeTab === 'practice') {
        fetchSongs(activeBandId);
        fetchPracticeSongs(activeBandId);
      }
    }
  }, [activeBandId, activeTab]);

  // Click outside to close song menu
  useEffect(() => {
    const handleClickOutside = (e) => {
      // Don't close if clicking on the settings button or inside the dropdown
      const target = e.target;
      if (target.closest('[title="Opciones"]') || target.closest('[class*="animate-slide-down"]')) {
        return;
      }
      setOpenSongMenu(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let { data: userBands, error: bandError } = await supabase
        .from('bands')
        .select('*')
        .eq('owner_id', user.id)
        .order('name');

      if (bandError) throw bandError;

      if (!userBands || userBands.length === 0) {
        const { data: newBand, error: createError } = await supabase
          .from('bands')
          .insert([{ name: 'Mi Proyecto Solista', owner_id: user.id }])
          .select()
          .single();
        if (createError) throw createError;
        userBands = [newBand];
      }

      setBands(userBands);
      setActiveBandId(userBands[0].id);
    } catch (error) {
      console.error('Error fetching data:', error.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSongs(bandId) {
    const { data } = await supabase.from('songs').select('*').eq('band_id', bandId).order('title');
    const songsData = data || [];
    setSongs(songsData);
    
    // Compute retention for all songs (section-based, consistent with PracticeView)
    if (songsData.length > 0) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const retentions = {};
        for (const song of songsData) {
          const retention = await calculateRetentionFromProgress(song.id, user.id);
          retentions[song.id] = retention;
        }
        setRetentionMap(retentions);
      }
    }
  }

  async function fetchEvents(bandId) {
    console.log('[DEBUG] fetchEvents called with bandId:', bandId);
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        setlist_songs (
          sort_order,
          songs (*)
        )
      `)
      .eq('band_id', bandId)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching events:', error);
      return;
    }
    console.log('[DEBUG] fetchEvents result:', data?.length, 'events');
    setEvents(data || []);
  }

  async function fetchSharedEvents() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('event_collaborators')
        .select(`
          event:events (
            *,
            setlist_songs (
              sort_order,
              songs (*)
            )
          )
        `)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching shared events:', error);
        return;
      }

      const sharedEvents = (data || [])
        .map(c => c.event)
        .filter(Boolean);
      
      setSharedEvents(sharedEvents || []);
    } catch (error) {
      console.error('Error fetching shared events:', error);
    }
  }

  async function fetchPracticeSongs(bandId) {
    console.log('[fetchPracticeSongs] bandId:', bandId);
    const { data, error } = await supabase
      .from('songs')
      .select(`
        *,
        song_section_progress (
          section_name,
          section_order,
          is_completed,
          completed_at,
          practice_count,
          last_practiced_at
        )
      `)
      .eq('band_id', bandId)
      .order('title');

    console.log('[fetchPracticeSongs] data:', data, 'error:', error);

    if (error) {
      console.error('Error fetching practice songs:', error);
      return;
    }

const { data: { user } } = await supabase.auth.getUser();
    console.log('[fetchPracticeSongs] user:', user);
    if (!user) return;
    
    console.log('[fetchPracticeSongs] songs found:', data?.length);
    
    // Calculate retention using SAME function as repertoire tab for consistency
    const songsWithProgress = await Promise.all((data || []).map(async (song) => {
      // Parse ALL sections from song content
      const allSections = parseSections(song.content);
      const totalSections = allSections.length;

      // Build progress map from DB
      const dbSections = song.song_section_progress || [];
      const progressMap = {};
      dbSections.forEach(p => {
        const key = getSectionKey({ name: p.section_name }, p.section_order);
        progressMap[key] = p;
      });

      // Count completed by checking each detected section against progress
      let completedSections = 0;
      allSections.forEach((section, index) => {
        const key = getSectionKey(section, index);
        if (progressMap[key]?.is_completed) {
          completedSections++;
        }
      });

      // Use same retention calculation as repertoire tab (includes recency bonus/stale penalty)
      const retention = await calculateRetentionFromProgress(song.id, user.id);

      return {
        ...song,
        practiceProgress: retention,
        totalSections,
        completedSections,
        sections: dbSections.sort((a, b) => a.section_order - b.section_order)
      };
    }));

    setPracticeSongs(songsWithProgress);
  }

  // Band management functions
  const handleCreateBand = async (e) => {
    e.preventDefault();
    if (!newBandName.trim()) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('bands')
        .insert([{ name: newBandName.trim(), owner_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      
      setBands(prev => [...prev, data]);
      setActiveBandId(data.id);
      setNewBandName('');
      setIsBandModalOpen(false);
    } catch (error) {
      console.error('Error creating band:', error);
      alert(`Error al crear proyecto: ${error.message}`);
    }
  };

  const handleUpdateBand = async (e) => {
    e.preventDefault();
    if (!editingBandId || !editBandName.trim()) return;

    try {
      const { error } = await supabase
        .from('bands')
        .update({ name: editBandName.trim() })
        .eq('id', editingBandId);

      if (error) throw error;

      setBands(prev => prev.map(b => b.id === editingBandId ? { ...b, name: editBandName.trim() } : b));
      setEditingBandId(null);
      setEditBandName('');
    } catch (error) {
      console.error('Error updating band:', error);
      alert(`Error al renombrar: ${error.message}`);
    }
  };

  const handleDeleteBand = async () => {
    if (!deleteConfirm?.id) return;

    try {
      // Delete all songs, events, setlist_songs, and attachments for this band
      const { data: songsToDelete } = await supabase.from('songs').select('id, mp3_url, pdf_url').eq('band_id', deleteConfirm.id);
      const { data: eventsToDelete } = await supabase.from('events').select('id').eq('band_id', deleteConfirm.id);

      // Delete attachments from storage
      if (songsToDelete) {
        for (const song of songsToDelete) {
          if (song.mp3_url) await supabase.storage.from('attachments').remove([song.mp3_url]);
          if (song.pdf_url) await supabase.storage.from('attachments').remove([song.pdf_url]);
        }
      }

      // Delete setlist_songs for events in this band
      if (eventsToDelete) {
        const eventIds = eventsToDelete.map(e => e.id);
        await supabase.from('setlist_songs').delete().in('event_id', eventIds);
      }

      // Delete songs, events, then band
      await supabase.from('songs').delete().eq('band_id', deleteConfirm.id);
      await supabase.from('events').delete().eq('band_id', deleteConfirm.id);
      const { error } = await supabase.from('bands').delete().eq('id', deleteConfirm.id);

      if (error) throw error;

      setBands(prev => prev.filter(b => b.id !== deleteConfirm.id));
      if (activeBandId === deleteConfirm.id) {
        const remaining = bands.filter(b => b.id !== deleteConfirm.id);
        setActiveBandId(remaining[0]?.id || null);
      }
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting band:', error);
      alert(`Error al eliminar proyecto: ${error.message}`);
    }
  };

  const cancelEditBand = () => {
    setEditingBandId(null);
    setEditBandName('');
  };

  // Delete functions
  const handleDeleteSong = async () => {
    if (!deleteConfirm?.id) return;

    try {
      // Get song to delete attachments
      const { data: song } = await supabase.from('songs').select('mp3_url, pdf_url').eq('id', deleteConfirm.id).single();
      
      if (song) {
        if (song.mp3_url) await supabase.storage.from('attachments').remove([song.mp3_url]);
        if (song.pdf_url) await supabase.storage.from('attachments').remove([song.pdf_url]);
      }

      // Delete setlist_songs references first
      await supabase.from('setlist_songs').delete().eq('song_id', deleteConfirm.id);
      
      // Delete song
      const { error } = await supabase.from('songs').delete().eq('id', deleteConfirm.id);
      if (error) throw error;

      setSongs(prev => prev.filter(s => s.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting song:', error);
      alert(`Error al eliminar canción: ${error.message}`);
    }
  };

  const handleDeleteEvent = async () => {
    if (!deleteConfirm?.id) return;

    try {
      // Delete setlist_songs first
      await supabase.from('setlist_songs').delete().eq('event_id', deleteConfirm.id);
      
      // Delete event
      const { error } = await supabase.from('events').delete().eq('id', deleteConfirm.id);
      if (error) throw error;

      setEvents(prev => prev.filter(e => e.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting event:', error);
      alert(`Error al eliminar setlist: ${error.message}`);
    }
  };

  const handleDeleteAttachment = async () => {
    if (!deleteConfirm?.id || !deleteConfirm.songId) return;

    try {
      const { data: song } = await supabase.from('songs').select('mp3_url, pdf_url').eq('id', deleteConfirm.songId).single();
      if (!song) throw new Error('Canción no encontrada');

      const urlToDelete = deleteConfirm.id === 'mp3' ? song.mp3_url : song.pdf_url;
      const fieldToUpdate = deleteConfirm.id === 'mp3' ? 'mp3_url' : 'pdf_url';

      if (urlToDelete) {
        await supabase.storage.from('attachments').remove([urlToDelete]);
      }

      const { error } = await supabase.from('songs').update({ [fieldToUpdate]: null }).eq('id', deleteConfirm.songId);
      if (error) throw error;

      // Refresh songs
      fetchSongs(activeBandId);
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting attachment:', error);
      alert(`Error al eliminar archivo: ${error.message}`);
    }
  };

  const confirmDelete = (type, id, name, songId) => {
    setDeleteConfirm({ type, id, name, songId });
  };

  const cancelDelete = () => setDeleteConfirm(null);

  const executeDelete = () => {
    switch (deleteConfirm?.type) {
      case 'song': handleDeleteSong(); break;
      case 'event': handleDeleteEvent(); break;
      case 'band': handleDeleteBand(); break;
      case 'attachment': handleDeleteAttachment(); break;
    }
  };

  const uploadAttachment = async (file, path) => {
    if (!file) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${path}/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('attachments').upload(filePath, file);
    if (uploadError) throw uploadError;

    return filePath;
  };

  const handleAddSong = async (e) => {
    e.preventDefault();
    
    let targetBandId = activeBandId;

    if (!targetBandId) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          alert("Error: No hay sesión de usuario activa.");
          return;
        }

        let { data: userBands } = await supabase
          .from('bands')
          .select('*')
          .eq('owner_id', user.id);

        if (!userBands || userBands.length === 0) {
          const { data: newBand, error: createError } = await supabase
            .from('bands')
            .insert([{ name: 'Mi Proyecto Solista', owner_id: user.id }])
            .select()
            .single();
          if (createError) throw createError;
          targetBandId = newBand.id;
          setBands([newBand]);
        } else {
          targetBandId = userBands[0].id;
          setBands(userBands);
        }
        setActiveBandId(targetBandId);
      } catch (err) {
        console.error("Error asegurando la banda:", err);
        alert(`Error al verificar tu banda: ${err.message}`);
        return;
      }
    }

    if (!newSongTitle.trim()) {
      alert("Error: El título no puede estar vacío.");
      return;
    }
    if (!newSongContent.trim()) {
      alert("Error: El contenido no puede estar vacío.");
      return;
    }

    try {
      setIsUploading(true);
      
      const parts = newSongDuration.split(':');
      const minutes = parseInt(parts[0] || '0', 10);
      const seconds = parseInt(parts[1] || '0', 10);
      const durationMs = ((minutes * 60) + seconds) * 1000;

      let mp3Path = editingSong?.mp3_url || null;
      let pdfPath = editingSong?.pdf_url || null;

      if (mp3File) mp3Path = await uploadAttachment(mp3File, targetBandId);
      if (pdfFile) pdfPath = await uploadAttachment(pdfFile, targetBandId);

      if (editingSong) {
        // Update existing song
        const { data, error } = await supabase
          .from('songs')
          .update({
            title: newSongTitle.trim(),
            content: newSongContent,
            duration_ms: durationMs,
            mp3_url: mp3Path,
            pdf_url: pdfPath,
          })
          .eq('id', editingSong.id)
          .select()
          .single();
          
        if (error) throw error;
        
        setSongs(prev => prev.map(s => s.id === editingSong.id ? data : s).sort((a, b) => a.title.localeCompare(b.title)));
      } else {
        // Create new song
        const { data, error } = await supabase
          .from('songs')
          .insert([{
            band_id: targetBandId,
            title: newSongTitle.trim(),
            content: newSongContent,
            duration_ms: durationMs,
            mp3_url: mp3Path,
            pdf_url: pdfPath,
            last_practiced: new Date().toISOString(),
            mastery_level: 1
          }])
          .select()
          .single();
          
        if (error) throw error;
        
        setSongs(prev => [...prev, data].sort((a, b) => a.title.localeCompare(b.title)));
      }
      
      setIsSongModalOpen(false);
      setEditingSong(null);
      
      setNewSongTitle('');
      setNewSongContent('');
      setNewSongDuration('03:30');
      setMp3File(null);
      setPdfFile(null);
    } catch (error) {
      console.error('Error saving song:', error);
      alert(`Error al guardar canción: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const openEditSong = (song) => {
    console.log('[DEBUG] openEditSong called with:', song);
    setEditingSong(song);
    setNewSongTitle(song.title);
    setNewSongContent(song.content);
    
    // Convert duration_ms to MM:SS format
    const totalSeconds = Math.floor((song.duration_ms || 210000) / 1000);
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    setNewSongDuration(`${mins}:${secs}`);
    
    setMp3File(null);
    setPdfFile(null);
    setIsSongModalOpen(true);
    console.log('[DEBUG] isSongModalOpen set to true, editingSong:', song);
  };

  // Debug modal open/close
  useEffect(() => {
    console.log('[DEBUG] Modal state changed:', { isSongModalOpen, editingSong: editingSong?.title });
  }, [isSongModalOpen, editingSong]);

  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!activeBandId || !newEventTitle.trim() || !newEventDate) {
      alert('Por favor completa el título y la fecha.');
      return;
    }

    try {
      // 1. Crear Evento
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .insert([{
          band_id: activeBandId,
          title: newEventTitle.trim(),
          date: new Date(newEventDate).toISOString(),
          location: newEventLocation.trim()
        }])
        .select()
        .single();

      if (eventError) throw eventError;

      // 2. Asociar Canciones al Setlist
      if (selectedSongIds.length > 0) {
        const setlistItems = selectedSongIds.map((songId, index) => ({
          event_id: eventData.id,
          song_id: songId,
          sort_order: index + 1
        }));

        const { error: setlistError } = await supabase
          .from('setlist_songs')
          .insert(setlistItems);

        if (setlistError) throw setlistError;
      }

      setIsEventModalOpen(false);
      setNewEventTitle('');
      setNewEventDate('');
      setNewEventLocation('');
      setSelectedSongIds([]);
      fetchEvents(activeBandId);
    } catch (error) {
      console.error('Error creating event:', error);
      alert(`Error al crear el setlist/evento: ${error.message}`);
    }
  };

  const toggleSongSelection = (songId) => {
    setSelectedSongIds(prev => 
      prev.includes(songId) ? prev.filter(id => id !== songId) : [...prev, songId]
    );
  };

  const handleEventClick = (songId, setlist) => {
    navigate(`/stage/${songId}`, { state: { setlist } });
  };

  const handleSectionToggle = async (songId, section) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      if (section.is_completed) {
        // Uncomplete: update progress to false
        await supabase
          .from('song_section_progress')
          .update({ 
            is_completed: false, 
            completed_at: null,
            practice_count: section.practice_count > 0 ? section.practice_count - 1 : 0
          })
          .eq('song_id', songId)
          .eq('user_id', user.id)
          .eq('section_name', section.section_name)
          .eq('section_order', section.section_order);
      } else {
        // Complete: upsert progress
        await supabase
          .from('song_section_progress')
          .upsert({
            song_id: songId,
            user_id: user.id,
            section_name: section.section_name,
            section_order: section.section_order,
            is_completed: true,
            completed_at: new Date().toISOString(),
            practice_count: (section.practice_count || 0) + 1,
            last_practiced_at: new Date().toISOString()
          }, {
            onConflict: 'song_id,user_id,section_name,section_order'
          });
      }
      
      // Refresh practice songs
      if (activeBandId) fetchPracticeSongs(activeBandId);
    } catch (error) {
      console.error('Error toggling section:', error);
      alert(`Error al actualizar sección: ${error.message}`);
    }
  }

  // Drag and drop handlers for setlist reordering
  const handleDragStart = (e, songId) => {
    setDraggingId(songId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', songId);
  };

  const handleDragOver = (e, songId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (songId !== draggingId) {
      setDragOverId(songId);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = async (e, targetSongId) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetSongId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get current setlist songs for this event
      const eventId = events.find(e => e.setlist_songs?.some(s => s.songs?.id === sourceId))?.id;
      if (!eventId) return;

      // Get current order
      const { data: setlistData } = await supabase
        .from('setlist_songs')
        .select('song_id, sort_order')
        .eq('event_id', eventId)
        .order('sort_order');

      if (!setlistData) return;

      // Reorder: move source to target position
      const sourceIndex = setlistData.findIndex(s => s.song_id === sourceId);
      const targetIndex = setlistData.findIndex(s => s.song_id === targetSongId);
      
      if (sourceIndex === -1 || targetIndex === -1) return;

      const newOrder = [...setlistData];
      const [moved] = newOrder.splice(sourceIndex, 1);
      newOrder.splice(targetIndex, 0, moved);

      // Update sort_order for all items
      const updates = newOrder.map((item, index) => ({
        song_id: item.song_id,
        sort_order: index + 1
      }));

      // Update in database
      for (const update of updates) {
        await supabase
          .from('setlist_songs')
          .update({ sort_order: update.sort_order })
          .eq('event_id', eventId)
          .eq('song_id', update.song_id);
      }

      // Refresh events
      fetchEvents(activeBandId);
    } catch (error) {
      console.error('Error reordering setlist:', error);
      alert('Error al reordenar: ' + error.message);
    } finally {
      setDraggingId(null);
      setDragOverId(null);
    }
  };

  const handleShareEvent = async (eventId, _eventTitle) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if share link already exists
      const { data: existing } = await supabase
        .from('shared_setlists')
        .select('token')
        .eq('event_id', eventId)
        .eq('permissions', 'read')
        .single();

      if (existing) {
        // Copy existing link to clipboard
        const shareUrl = `${window.location.origin}/s/${existing.token}`;
        await navigator.clipboard.writeText(shareUrl);
        alert(`¡Link copiado al portapapeles!\n${shareUrl}`);
        return;
      }

      // Create new share link
      const { data, error } = await supabase
        .from('shared_setlists')
        .insert({
          event_id: eventId,
          permissions: 'read',
        })
        .select('token')
        .single();

      if (error) throw error;

      const shareUrl = `${window.location.origin}/s/${data.token}`;
      await navigator.clipboard.writeText(shareUrl);
      alert(`¡Setlist compartido!\nLink copiado: ${shareUrl}\n\nComparte este link con tus músicos.`);
    } catch (error) {
      console.error('Error sharing setlist:', error);
      alert('Error al compartir: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen p-3 md:p-6 max-w-4xl mx-auto">
      <header className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2 tracking-wider">
            STAGE<span className="text-amber-400">SET</span>
          </h1>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-3 md:gap-4 w-full md:w-auto">
          {/* Band selector with management */}
          <div className="relative w-full md:w-auto flex-1 min-w-0">
            <select 
              value={activeBandId || ''}
              onChange={(e) => setActiveBandId(e.target.value)}
              className="w-full bg-panel border border-gray-700 text-white rounded-xl px-4 py-2 focus:outline-none focus:border-amber-400 font-medium pr-10 appearance-none text-sm"
            >
              {bands.map(band => (
                <option key={band.id} value={band.id}>{band.name}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
              <ChevronDown size={18} />
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-center md:justify-end">
            <button
              onClick={() => { setNewBandName(''); setIsBandModalOpen(true); }}
              className="p-2 bg-[#1A1A20] rounded-xl text-gray-400 hover:text-white hover:bg-gray-700 transition-colors border border-gray-800"
              title="Nuevo Proyecto/Banda"
            >
              <Plus size={20} />
            </button>
            {editingBandId ? (
              <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  value={editBandName}
                  onChange={(e) => setEditBandName(e.target.value)}
                  className="bg-panel border border-amber-400 text-white rounded-xl px-3 py-2 text-sm focus:outline-none w-full sm:w-40"
                  autoFocus
                />
                <button onClick={handleUpdateBand} className="p-2 bg-amber-400 text-black rounded-xl hover:bg-amber-500" title="Guardar">
                  <Save size={16} />
                </button>
                <button onClick={cancelEditBand} className="p-2 bg-gray-700 text-gray-400 rounded-xl hover:bg-gray-600" title="Cancelar">
                  <X size={16} />
                </button>
              </div>
            ) : bands.length > 1 && activeBandId && (
              <button
                onClick={() => confirmDelete('band', activeBandId, bands.find(b => b.id === activeBandId)?.name)}
                className="p-2 bg-[#1A1A20] rounded-xl text-gray-400 hover:text-red-400 hover:bg-gray-700 transition-colors border border-gray-800"
                title="Eliminar Proyecto/Banda"
              >
                <Trash2 size={20} />
              </button>
            )}
            <button
              onClick={() => supabase.auth.signOut()}
              className="p-2 bg-[#1A1A20] rounded-xl text-gray-400 hover:text-white transition-colors border border-gray-800"
              title="Cerrar Sesión"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Tabs - responsive, expand to fill space on wider screens */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button 
          onClick={() => setActiveTab('songs')}
          className={`flex-1 min-w-[80px] flex items-center justify-center gap-2 px-3 sm:px-6 py-2.5 sm:py-3 rounded-xl font-medium transition-colors text-sm sm:font-medium ${activeTab === 'songs' ? 'bg-amber-400 text-black font-bold' : 'bg-panel text-gray-400 hover:text-white'}`}
        >
          <Folder size={16} className="shrink-0" /> <span className="hidden sm:inline">Repertorio</span>
        </button>
        <button 
          onClick={() => setActiveTab('events')}
          className={`flex-1 min-w-[80px] flex items-center justify-center gap-2 px-3 sm:px-6 py-2.5 sm:py-3 rounded-xl font-medium transition-colors text-sm sm:font-medium ${activeTab === 'events' ? 'bg-amber-400 text-black font-bold' : 'bg-panel text-gray-400 hover:text-white'}`}
        >
          <Calendar size={16} className="shrink-0" /> <span className="hidden sm:inline">Setlists</span>
        </button>
        <button 
          onClick={() => setActiveTab('shared')}
          className={`flex-1 min-w-[80px] flex items-center justify-center gap-2 px-3 sm:px-6 py-2.5 sm:py-3 rounded-xl font-medium transition-colors text-sm sm:font-medium ${activeTab === 'shared' ? 'bg-blue-500 text-white font-bold' : 'bg-panel text-gray-400 hover:text-white'}`}
        >
          <Users size={16} className="shrink-0" /> <span className="hidden sm:inline">Compartidos</span>
        </button>
        <button 
          onClick={() => setActiveTab('practice')}
          className={`flex-1 min-w-[80px] flex items-center justify-center gap-2 px-3 sm:px-6 py-2.5 sm:py-3 rounded-xl font-medium transition-colors text-sm sm:font-medium ${activeTab === 'practice' ? 'bg-amber-400 text-black font-bold' : 'bg-panel text-gray-400 hover:text-white'}`}
        >
          <Brain size={16} className="shrink-0" /> <span className="hidden sm:inline">Practicar</span>
        </button>
      </div>

      <div className="bg-panel rounded-3xl p-6 shadow-2xl border border-gray-800 mb-8 min-h-[50vh]">
        {activeTab === 'songs' && (
          <>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Canciones</h2>
              <button 
                onClick={() => setIsSongModalOpen(true)}
                className="bg-amber-400 text-black px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-amber-500 transition-colors shadow-[0_0_15px_rgba(251,191,36,0.2)]"
              >
                <Plus size={18} />
                Añadir Canción
              </button>
            </div>

            {loading ? (
              <div className="text-center text-gray-400 py-12">Cargando catálogo...</div>
            ) : songs.length === 0 ? (
              <div className="text-center text-gray-500 py-16 border-2 border-dashed border-gray-800 rounded-2xl">
                No tienes canciones en este proyecto.
              </div>
            ) : (
              <div className="grid gap-4">
                {songs.map((song) => {
                  const retention = retentionMap[song.id] ?? 0;
                  
                  let barColor = 'bg-red-500';
                  if (retention >= 80) barColor = 'bg-green-500';
                  else if (retention >= 40) barColor = 'bg-amber-400';

                  return (
                    <div 
                      key={song.id} 
                      className="bg-[#1A1A20] p-5 rounded-2xl flex items-center justify-between hover:bg-[#22222A] transition-colors border border-transparent hover:border-gray-700 group relative"
                    >
                      <div className="flex-1 mr-6 min-w-0">
                        <div className="flex items-center gap-3">
                          <h3 className="font-bold text-white text-lg truncate">{song.title}</h3>
                          {(song.mp3_url || song.pdf_url) && (
                            <span className="bg-gray-800 px-2 py-1 rounded text-xs font-mono text-gray-400 flex-shrink-0">
                              ATTACHMENTS
                            </span>
                          )}
                        </div>
                        
                        <div className="mt-3">
                          <div className="flex justify-between text-xs mb-1 font-mono">
                            <span className="text-gray-400">Retención de Memoria</span>
                            <span className="text-white">{retention}% (Lvl {song.mastery_level})</span>
                          </div>
                          <div className="w-full h-2 bg-black rounded-full overflow-hidden">
                            <div className={`h-full ${barColor} transition-all duration-1000`} style={{ width: `${retention}%` }}></div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Action buttons */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Stage mode button */}
                        <button
                          onClick={() => navigate(`/stage/${song.id}`)}
                          className="w-14 h-14 bg-amber-400 text-black rounded-full flex items-center justify-center hover:bg-amber-500 hover:scale-105 transition-all shadow-[0_0_20px_rgba(251,191,36,0.15)] group-hover:shadow-[0_0_25px_rgba(251,191,36,0.4)] flex-shrink-0"
                          title="Modo Escenario"
                        >
                          <Play size={28} className="ml-1" />
                        </button>
                        
                        {/* Dropdown menu for song actions */}
                        <div className="relative">
                          <button
                            onClick={(e) => { console.log('[DEBUG] Settings button clicked'); e.stopPropagation(); setOpenSongMenu(song.id); }}
                            className="p-2 bg-gray-800 rounded-xl text-gray-400 hover:text-white hover:bg-gray-700 transition-colors border border-gray-700"
                            title="Opciones"
                          >
                            <Settings size={20} />
                          </button>
                          {openSongMenu === song.id && (
                            <div className="absolute right-0 top-full mt-2 bg-panel rounded-xl shadow-2xl border border-gray-700 py-1 min-w-[180px] z-20 animate-slide-down">
                              <button
                                onClick={() => { console.log('Edit button clicked'); openEditSong(song); setOpenSongMenu(null); }}
                                className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2"
                              >
                                <Edit size={16} /> Editar Canción
                              </button>
                              <hr className="border-gray-700 my-1" />
                              <button
                                onClick={() => { confirmDelete('attachment', 'mp3', 'Audio MP3', song.id); setOpenSongMenu(null); }}
                                disabled={!song.mp3_url}
                                className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Music2 size={16} /> Eliminar Audio
                              </button>
                              <button
                                onClick={() => { confirmDelete('attachment', 'pdf', 'PDF', song.id); setOpenSongMenu(null); }}
                                disabled={!song.pdf_url}
                                className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Folder size={16} /> Eliminar PDF
                              </button>
                              <hr className="border-gray-700 my-1" />
                              <button
                                onClick={() => { confirmDelete('song', song.id, song.title); setOpenSongMenu(null); }}
                                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 flex items-center gap-2"
                              >
                                <Trash2 size={16} /> Eliminar Canción
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {activeTab === 'events' && (
          <>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Eventos & Setlists</h2>
              <button 
                onClick={() => setIsEventModalOpen(true)}
                className="bg-amber-400 text-black px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-amber-500 transition-colors shadow-[0_0_15px_rgba(251,191,36,0.2)]"
              >
                <Plus size={18} />
                Nuevo Setlist
              </button>
            </div>

            {events.length === 0 ? (
              <div className="text-center text-gray-500 py-16 border-2 border-dashed border-gray-800 rounded-2xl">
                No has programado eventos o setlists aún.
              </div>
            ) : (
              <div className="grid gap-6">
                {events.map((evt) => {
                  const setlistSongs = evt.setlist_songs
                    ? evt.setlist_songs
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map(item => item.songs)
                        .filter(Boolean)
                    : [];

                  const firstSongId = setlistSongs[0]?.id;

                  return (
                    <div key={evt.id} className="bg-[#1A1A20] p-6 rounded-2xl border border-gray-800">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-gray-800">
                        <div>
                          <h3 className="text-2xl font-bold text-white">{evt.title}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar size={16} className="text-amber-400" />
                              {new Date(evt.date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </span>
                            {evt.location && (
                              <span className="flex items-center gap-1">
                                <MapPin size={16} className="text-amber-400" />
                                {evt.location}
                              </span>
                            )}
                          </div>
                        </div>

                        {firstSongId && (
                          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto flex-wrap">
                            <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
                              <button
                                onClick={() => navigate(`/practice/setlist/${evt.id}`)}
                                className="flex-1 sm:flex-none min-w-[160px] bg-green-500 text-black px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-600 transition-colors shadow-[0_0_15px_rgba(34,197,94,0.3)] text-sm"
                              >
                                <Target size={20} className="fill-black" />
                                Practicar Setlist
                              </button>
                              <button
                                onClick={() => handleEventClick(firstSongId, setlistSongs)}
                                className="flex-1 sm:flex-none min-w-[160px] bg-amber-400 text-black px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-amber-500 transition-colors shadow-[0_0_15px_rgba(251,191,36,0.3)] text-sm"
                              >
                                <Play size={20} className="fill-black" />
                                Iniciar Show
                              </button>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => handleShareEvent(evt.id, evt.title)}
                                className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                                title="Compartir Setlist"
                              >
                                <Share2 size={20} />
                              </button>
                              <button
                                onClick={() => confirmDelete('event', evt.id, evt.title)}
                                className="p-3 bg-gray-800 rounded-xl text-gray-400 hover:text-red-400 hover:bg-gray-700 transition-colors"
                                title="Eliminar Setlist"
                              >
                                <Trash2 size={20} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Lista de Canciones del Setlist */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs uppercase tracking-wider text-gray-500 font-bold">Orden del Repertorio:</p>
                          <p className="text-xs text-gray-400">Arrastra para reordenar</p>
                        </div>
                        {setlistSongs.length === 0 ? (
                          <p className="text-sm text-gray-500 italic">Sin canciones asignadas.</p>
                        ) : (
                          setlistSongs.map((song, idx) => (
                            <div 
                              key={song.id} 
                              className={`flex items-center justify-between bg-black/40 px-4 py-2 rounded-lg text-sm transition-all duration-200 ${
                                draggingId === song.id ? 'opacity-50 scale-102 ring-2 ring-amber-400' : ''
                              } ${dragOverId === song.id ? 'bg-amber-900/20 ring-1 ring-amber-500' : ''}`}
                              draggable
                              onDragStart={(e) => handleDragStart(e, song.id)}
                              onDragOver={(e) => handleDragOver(e, song.id)}
                              onDragLeave={handleDragLeave}
                              onDrop={(e) => handleDrop(e, song.id)}
                            >
                              <button
                                className="text-gray-500 hover:text-amber-400 p-1 mr-2"
                                onMouseDown={(e) => e.stopPropagation()}
                                title="Arrastrar para reordenar"
                              >
                                <GripVertical size={18} />
                              </button>
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <span className="text-amber-400 font-mono font-bold w-6">{idx + 1}.</span>
                                <span className="text-white font-medium truncate">{song.title}</span>
                              </div>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleEventClick(song.id, setlistSongs); }}
                                className="text-gray-400 hover:text-amber-400 text-xs flex items-center gap-1"
                              >
                                Abrir <Play size={12} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
        
        {/* Practicar Tab */}
        {activeTab === 'practice' && (
          <>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Brain className="text-amber-400" />
                Sesiones de Práctica
              </h2>
            </div>

            {loading ? (
              <div className="text-center text-gray-400 py-12">Cargando canciones...</div>
            ) : practiceSongs.length === 0 ? (
              <div className="text-center text-gray-500 py-16 border-2 border-dashed border-gray-800 rounded-2xl">
                <Brain className="text-4xl text-gray-700 mb-4" />
                <p className="text-lg mb-2">No hay canciones para practicar</p>
                <p className="text-sm">Añade canciones a tu repertorio para empezar a practicar</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {practiceSongs.map((song) => (
                  <div 
                    key={song.id} 
                    className="bg-[#1A1A20] p-5 rounded-2xl flex flex-col hover:bg-[#22222A] transition-colors border border-transparent hover:border-gray-700"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <h3 className="font-bold text-white text-lg truncate">{song.title}</h3>
                        {(song.mp3_url || song.pdf_url) && (
                          <span className="bg-gray-800 px-2 py-1 rounded text-xs font-mono text-gray-400 flex-shrink-0">
                            ATTACHMENTS
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="w-20 h-20 rounded-full flex items-center justify-center bg-gray-800 relative">
                          <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 100 100">
                            <circle 
                              cx="50" cy="50" r="45" 
                              fill="none" stroke="#374151" strokeWidth="8"
                            />
                            <circle 
                              cx="50" cy="50" r="45" 
                              fill="none" stroke="#fbbf24" strokeWidth="8"
                              strokeDasharray={`${song.practiceProgress * 2.83} 283`}
                              strokeDashoffset="0"
                              strokeLinecap="round"
                              className="transition-all duration-1000"
                            />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg">
                            {song.practiceProgress}%
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <p className="text-xs uppercase tracking-wider text-gray-500 font-bold">Progreso por sección:</p>
                      {song.sections && song.sections.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {song.sections.map((section, _idx) => (
                            <button
                              key={`${song.id}-${section.section_name}-${section.section_order}`}
                              onClick={() => handleSectionToggle(song.id, section)}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border-2 ${
                                section.is_completed 
                                  ? 'bg-green-500 text-white border-green-500' 
                                  : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-amber-400'
                              }`}
                            >
                              {section.section_name} {section.section_order > 0 ? `#${section.section_order}` : ''}
                              {section.is_completed && <CheckSquare size={12} className="ml-1" />}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">Sin secciones detectadas. Añade marcadores [Intro], [Verse], [Chorus], etc. en la canción.</p>
                      )}
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-gray-800">
                      <button
                        onClick={() => navigate(`/practice/${song.id}`)}
                        className="flex-1 bg-amber-400 text-black py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-amber-500 transition-colors shadow-[0_0_15px_rgba(251,191,36,0.2)]"
                      >
                        <Target size={18} /> Iniciar Práctica
                      </button>
                      <button
                        onClick={() => navigate(`/stage/${song.id}`)}
                        className="w-full sm:w-auto px-4 py-3 bg-gray-800 text-white rounded-xl font-medium hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Play size={18} /> Modo Escenario
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Compartidos Tab */}
        {activeTab === 'shared' && (
          <>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Users className="text-blue-400" />
                Setlists Compartidos Conmigo
              </h2>
            </div>

            {loading ? (
              <div className="text-center text-gray-400 py-12">Cargando setlists...</div>
            ) : sharedEvents.length === 0 ? (
              <div className="text-center text-gray-500 py-16 border-2 border-dashed border-gray-800 rounded-2xl">
                <Users className="text-4xl text-gray-700 mb-4" />
                <p className="text-lg mb-2">No tienes setlists compartidos</p>
                <p className="text-sm">Cuando alguien te comparta un setlist, aparecerá aquí</p>
              </div>
            ) : (
              <div className="grid gap-6">
                {sharedEvents.map((evt) => {
                  const setlistSongs = evt.setlist_songs
                    ? evt.setlist_songs
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map(item => item.songs)
                        .filter(Boolean)
                    : [];

                  const firstSongId = setlistSongs[0]?.id;

                  return (
                    <div key={evt.id} className="bg-[#1A1A20] p-6 rounded-2xl border border-gray-800">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-gray-800">
                        <div>
                          <h3 className="text-2xl font-bold text-white">{evt.title}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar size={16} className="text-blue-400" />
                              {new Date(evt.date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </span>
                            {evt.location && (
                              <span className="flex items-center gap-1">
                                <MapPin size={16} className="text-blue-400" />
                                {evt.location}
                              </span>
                            )}
                          </div>
                        </div>

                        {firstSongId && (
                          <div className="flex items-center gap-3 flex-wrap">
                            <button
                              onClick={() => navigate(`/practice/setlist/${evt.id}`)}
                              className="flex-1 sm:flex-none min-w-[160px] bg-green-500 text-black px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-600 transition-colors shadow-[0_0_15px_rgba(34,197,94,0.3)] text-sm"
                            >
                              <Target size={20} className="fill-black" />
                              Practicar Setlist
                            </button>
                            <button
                              onClick={() => handleEventClick(firstSongId, setlistSongs)}
                              className="flex-1 sm:flex-none min-w-[160px] bg-blue-500 text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors text-sm"
                            >
                              <Play size={20} className="fill-white" />
                              Ver Setlist
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Lista de Canciones del Setlist */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs uppercase tracking-wider text-gray-500 font-bold">Orden del Repertorio:</p>
                        </div>
                        {setlistSongs.length === 0 ? (
                          <p className="text-sm text-gray-500 italic">Sin canciones asignadas.</p>
                        ) : (
                          setlistSongs.map((song, idx) => (
                            <div key={song.id} className="flex items-center justify-between bg-black/40 px-4 py-2 rounded-lg text-sm">
                              <div className="flex items-center gap-3">
                                <span className="text-blue-400 font-mono font-bold w-6">{idx + 1}.</span>
                                <span className="text-white font-medium">{song.title}</span>
                              </div>
                              <button 
                                onClick={() => handleEventClick(song.id, setlistSongs)}
                                className="text-gray-400 hover:text-blue-400 text-xs flex items-center gap-1"
                              >
                                Abrir <Play size={12} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
      {isSongModalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 overflow-y-auto" onClick={() => setIsSongModalOpen(false)}>
          <div className="bg-panel rounded-3xl p-8 w-full max-w-2xl border border-gray-800 my-8" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Mic2 className="text-amber-400" />
              {editingSong ? 'Editar Canción' : 'Nueva Canción'}
            </h2>
            <form onSubmit={handleAddSong} className="flex flex-col gap-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Título</label>
                  <input
                    type="text"
                    required
                    value={newSongTitle}
                    onChange={(e) => setNewSongTitle(e.target.value)}
                    className="w-full bg-[#1A1A20] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-400"
                    placeholder="Ej: Wonderwall"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Duración (MM:SS)</label>
                  <input
                    type="text"
                    required
                    pattern="[0-9]{2}:[0-9]{2}"
                    value={newSongDuration}
                    onChange={(e) => setNewSongDuration(e.target.value)}
                    className="w-full bg-[#1A1A20] border border-gray-700 rounded-xl px-4 py-3 text-white font-mono focus:outline-none focus:border-amber-400"
                    placeholder="03:30"
                  />
                  <p className="text-xs text-gray-500 mt-1">Calcula el autoscroll.</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Acordes y Letra (Formato ChordPro)</label>
                <textarea
                  required
                  value={newSongContent}
                  onChange={(e) => setNewSongContent(e.target.value)}
                  className="w-full bg-[#1A1A20] border border-gray-700 rounded-xl px-4 py-3 text-white h-64 font-mono text-sm focus:outline-none focus:border-amber-400"
                  placeholder="[Em]Today is [G]gonna be the day..."
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4 bg-[#1A1A20] rounded-xl border border-gray-800">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Audio de Referencia (MP3)</label>
                  <input
                    type="file"
                    accept="audio/mpeg, audio/mp3"
                    onChange={(e) => setMp3File(e.target.files[0])}
                    className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-800 file:text-white hover:file:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Partitura/Tab (PDF)</label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setPdfFile(e.target.files[0])}
                    className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-800 file:text-white hover:file:bg-gray-700"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsSongModalOpen(false)}
                  disabled={isUploading}
                  className="px-6 py-3 text-gray-400 hover:text-white font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="bg-amber-400 text-black px-8 py-3 rounded-xl font-bold hover:bg-amber-500 transition-colors disabled:opacity-50"
                >
                  {isUploading ? 'Guardando...' : (editingSong ? 'Guardar Cambios' : 'Guardar Canción')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nuevo Evento / Setlist */}
      {isEventModalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-panel rounded-3xl p-8 w-full max-w-2xl border border-gray-800 my-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Calendar className="text-amber-400" />
              Nuevo Evento / Setlist
            </h2>
            <form onSubmit={handleAddEvent} className="flex flex-col gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Nombre del Evento / Show</label>
                <input
                  type="text"
                  required
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  className="w-full bg-[#1A1A20] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-400"
                  placeholder="Ej: Concierto en Bar Central"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Fecha y Hora</label>
                  <input
                    type="datetime-local"
                    required
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    className="w-full bg-[#1A1A20] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Lugar / Ubicación (Opcional)</label>
                  <input
                    type="text"
                    value={newEventLocation}
                    onChange={(e) => setNewEventLocation(e.target.value)}
                    className="w-full bg-[#1A1A20] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-400"
                    placeholder="Ej: Teatro Principal"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Selecciona las canciones del Setlist</label>
                {songs.length === 0 ? (
                  <p className="text-sm text-gray-500">Primero debes agregar canciones a tu catálogo para crear un setlist.</p>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-2 p-3 bg-[#1A1A20] rounded-xl border border-gray-800">
                    {songs.map((song) => {
                      const isSelected = selectedSongIds.includes(song.id);
                      return (
                        <div 
                          key={song.id} 
                          onClick={() => toggleSongSelection(song.id)}
                          className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-amber-400/10 border border-amber-400/40 text-amber-400' : 'hover:bg-gray-800 text-gray-300'}`}
                        >
                          <div className="flex items-center gap-3">
                            {isSelected ? <CheckSquare size={20} className="text-amber-400" /> : <Square size={20} className="text-gray-600" />}
                            <span className="font-medium">{song.title}</span>
                          </div>
                          {isSelected && (
                            <span className="text-xs font-mono bg-amber-400/20 px-2 py-1 rounded">
                              #{selectedSongIds.indexOf(song.id) + 1}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsEventModalOpen(false)}
                  className="px-6 py-3 text-gray-400 hover:text-white font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-amber-400 text-black px-8 py-3 rounded-xl font-bold hover:bg-amber-500 transition-colors"
                >
                  Crear Setlist
                </button>
</div>
             </form>
           </div>
         </div>
          )}

     {/* Modal Nueva Banda / Proyecto */}
     {isBandModalOpen && (
       <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 overflow-y-auto">
         <div className="bg-panel rounded-3xl p-8 w-full max-w-md border border-gray-800 my-8">
           <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
             <Users className="text-amber-400" />
             Nuevo Proyecto / Banda
           </h2>
           <form onSubmit={handleCreateBand} className="flex flex-col gap-5">
             <div>
               <label className="block text-sm font-medium text-gray-400 mb-2">Nombre del Proyecto / Banda</label>
               <input
                 type="text"
                 required
                 value={newBandName}
                 onChange={(e) => setNewBandName(e.target.value)}
                 className="w-full bg-[#1A1A20] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-400"
                 placeholder="Ej: Los Rockeros, Mi Banda, Proyecto Solo"
                 autoFocus
               />
             </div>
             
             <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-800">
               <button
                 type="button"
                 onClick={() => setIsBandModalOpen(false)}
                 className="px-6 py-3 text-gray-400 hover:text-white font-medium transition-colors"
               >
                 Cancelar
               </button>
               <button
                 type="submit"
                 className="bg-amber-400 text-black px-8 py-3 rounded-xl font-bold hover:bg-amber-500 transition-colors"
               >
                 Crear Proyecto
               </button>
             </div>
           </form>
         </div>
       </div>
     )}

     {/* Delete Confirmation Modal */}
     {deleteConfirm && (
       <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
         <div className="bg-panel rounded-3xl p-8 w-full max-w-md border border-gray-800 my-8">
           <div className="flex items-center gap-3 mb-4">
             <div className="w-12 h-12 bg-red-900/30 rounded-full flex items-center justify-center">
               <Trash2 size={24} className="text-red-400" />
             </div>
             <h2 className="text-xl font-bold text-white">Confirmar Eliminación</h2>
           </div>
           
           <p className="text-gray-300 mb-6">
             ¿Estás seguro de que quieres eliminar <strong className="text-white">{deleteConfirm.name}</strong>?
             {deleteConfirm.type === 'song' && <span className="text-red-400"> Esta acción no se puede deshacer y también eliminará los archivos adjuntos (MP3/PDF).</span>}
             {deleteConfirm.type === 'event' && <span className="text-red-400"> Se eliminará el setlist completo.</span>}
             {deleteConfirm.type === 'band' && <span className="text-red-400"> ¡Esto eliminará TODAS las canciones, setlists y archivos de este proyecto!</span>}
             {deleteConfirm.type === 'attachment' && <span className="text-red-400"> El archivo se eliminará permanentemente.</span>}
           </p>
           
           <div className="flex justify-end gap-3">
             <button
               onClick={cancelDelete}
               className="px-6 py-3 text-gray-400 hover:text-white font-medium transition-colors"
             >
               Cancelar
             </button>
             <button
               onClick={executeDelete}
               className="bg-red-500 text-white px-8 py-3 rounded-xl font-bold hover:bg-red-600 transition-colors"
             >
               Eliminar
             </button>
           </div>
         </div>
       </div>
     )}
   </div>
 );
}
