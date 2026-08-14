-- 20240101000002_practice_tables.sql
-- Practice tracking tables: practice_sessions, song_section_progress

-- Create practice_sessions (Registro de cada sesión de práctica)
CREATE TABLE public.practice_sessions (
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
CREATE TABLE public.song_section_progress (
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

-- Indexes for performance
CREATE INDEX idx_practice_sessions_song_id ON public.practice_sessions(song_id);
CREATE INDEX idx_practice_sessions_user_id ON public.practice_sessions(user_id);
CREATE INDEX idx_practice_sessions_started_at ON public.practice_sessions(started_at);
CREATE INDEX idx_song_section_progress_song_user ON public.song_section_progress(song_id, user_id);