-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create bands table
CREATE TABLE IF NOT EXISTS public.bands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create songs table
CREATE TABLE IF NOT EXISTS public.songs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL, -- ChordPro format
    duration_ms INTEGER DEFAULT 210000, -- Default 3:30 in ms
    mp3_url TEXT,
    pdf_url TEXT,
    last_practiced TIMESTAMP WITH TIME ZONE,
    mastery_level INTEGER DEFAULT 1 CHECK (mastery_level >= 1 AND mastery_level <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create events table (Setlists)
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create setlist_songs (Many-to-Many relationship between events and songs)
CREATE TABLE IF NOT EXISTS public.setlist_songs (
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (event_id, song_id)
);

-- Create practice_sessions (Registro de cada sesión de práctica)
CREATE TABLE IF NOT EXISTS public.practice_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    sections_completed INTEGER DEFAULT 0,
    total_sections INTEGER DEFAULT 0,
    mastery_gained INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create song_section_progress (Progreso por sección de cada canción)
CREATE TABLE IF NOT EXISTS public.song_section_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    section_name TEXT NOT NULL, -- 'Intro', 'Verse', 'Chorus', etc.
    section_order INTEGER NOT NULL DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    practice_count INTEGER DEFAULT 0,
    last_practiced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(song_id, user_id, section_name, section_order)
);

-- Shared setlists (read-only links)
CREATE TABLE IF NOT EXISTS public.shared_setlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
    permissions TEXT DEFAULT 'read', -- 'read' | 'comment'
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Event collaborators (registered users)
CREATE TABLE IF NOT EXISTS public.event_collaborators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor', 'admin')),
    invited_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(event_id, user_id)
);

-- Setup Row Level Security (RLS)
ALTER TABLE public.bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setlist_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_section_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_setlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_collaborators ENABLE ROW LEVEL SECURITY;

-- Policies for bands
DROP POLICY IF EXISTS "Users can view their own bands" ON public.bands;
DROP POLICY IF EXISTS "Users can insert their own bands" ON public.bands;
DROP POLICY IF EXISTS "Users can update their own bands" ON public.bands;
DROP POLICY IF EXISTS "Users can delete their own bands" ON public.bands;

CREATE POLICY "Users can view their own bands"
    ON public.bands FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert their own bands"
    ON public.bands FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update their own bands"
    ON public.bands FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete their own bands"
    ON public.bands FOR DELETE USING (auth.uid() = owner_id);

-- Policies for songs
DROP POLICY IF EXISTS "Users can manage songs of their bands" ON public.songs;
CREATE POLICY "Users can manage songs of their bands"
    ON public.songs FOR ALL
    USING (EXISTS (SELECT 1 FROM public.bands WHERE bands.id = songs.band_id AND bands.owner_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.bands WHERE bands.id = songs.band_id AND bands.owner_id = auth.uid()));

-- Policies for events - SIMPLE OWNER-BASED ONLY (no recursion)
DROP POLICY IF EXISTS "Users can manage events of their bands" ON public.events;
CREATE POLICY "Users can manage events of their bands"
    ON public.events FOR ALL
    USING (EXISTS (SELECT 1 FROM public.bands WHERE bands.id = events.band_id AND bands.owner_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.bands WHERE bands.id = events.band_id AND bands.owner_id = auth.uid()));

-- Policies for setlist_songs
DROP POLICY IF EXISTS "Users can manage setlist songs" ON public.setlist_songs;
CREATE POLICY "Users can manage setlist songs"
    ON public.setlist_songs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.events 
            JOIN public.bands ON events.band_id = bands.id 
            WHERE events.id = setlist_songs.event_id AND bands.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.events 
            JOIN public.bands ON events.band_id = bands.id 
            WHERE events.id = setlist_songs.event_id AND bands.owner_id = auth.uid()
        )
    );

-- Policies for practice_sessions
DROP POLICY IF EXISTS "Users can manage their practice sessions" ON public.practice_sessions;
CREATE POLICY "Users can manage their practice sessions"
    ON public.practice_sessions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policies for song_section_progress
DROP POLICY IF EXISTS "Users can manage their section progress" ON public.song_section_progress;
CREATE POLICY "Users can manage their section progress"
    ON public.song_section_progress FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policies for shared_setlists
DROP POLICY IF EXISTS "Owner can manage shared links" ON public.shared_setlists;
CREATE POLICY "Owner can manage shared links"
    ON public.shared_setlists FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.events e
            JOIN public.bands b ON e.band_id = b.id
            WHERE e.id = shared_setlists.event_id
            AND b.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.events e
            JOIN public.bands b ON e.band_id = b.id
            WHERE e.id = shared_setlists.event_id
            AND b.owner_id = auth.uid()
        )
    );

-- Public read access for shared links (via token)
CREATE POLICY "Public read shared links" ON public.shared_setlists
    FOR SELECT USING (true);

-- Policies for event_collaborators - SIN REFERENCIAR EVENTS PARA EVITAR RECURSIÓN
DROP POLICY IF EXISTS "Owner manages collaborators" ON public.event_collaborators;
CREATE POLICY "Owner manages collaborators"
    ON public.event_collaborators FOR ALL
    USING (auth.uid() = invited_by)
    WITH CHECK (auth.uid() = invited_by);

-- Collaborator sees own row
CREATE POLICY "Collaborator sees own row" ON public.event_collaborators
    FOR SELECT USING (user_id = auth.uid());

-- Function to increment mastery level when all sections completed
CREATE OR REPLACE FUNCTION public.increment_mastery(p_song_id UUID, p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_current_level INTEGER;
  v_total_sections INTEGER;
  v_completed_sections INTEGER;
BEGIN
  -- Get current mastery level
  SELECT mastery_level INTO v_current_level FROM public.songs WHERE id = p_song_id;
  
  -- Count total and completed sections
  SELECT COUNT(*) INTO v_total_sections 
  FROM public.song_section_progress 
  WHERE song_id = p_song_id AND user_id = p_user_id;
  
  SELECT COUNT(*) INTO v_completed_sections 
  FROM public.song_section_progress 
  WHERE song_id = p_song_id AND user_id = p_user_id AND is_completed = TRUE;
  
  -- Only increment if all sections completed and not at max level
  IF v_total_sections > 0 AND v_completed_sections = v_total_sections AND v_current_level < 5 THEN
    UPDATE public.songs 
    SET mastery_level = v_current_level + 1 
    WHERE id = p_song_id;
  END IF;
END;
$$;

-- Setup Storage for attachments (Must be executed by a superuser or manually in UI if SQL fails)
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', false) ON CONFLICT DO NOTHING;

-- RLS for Storage (Assuming 'attachments' bucket)
DROP POLICY IF EXISTS "Users can view attachments if authenticated" ON storage.objects;
CREATE POLICY "Users can view attachments if authenticated"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'attachments' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can upload attachments if authenticated" ON storage.objects;
CREATE POLICY "Users can upload attachments if authenticated"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'attachments' AND auth.role() = 'authenticated');