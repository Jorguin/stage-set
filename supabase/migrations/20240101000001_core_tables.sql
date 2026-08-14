-- 20240101000001_core_tables.sql
-- Core tables: bands, songs, events, setlist_songs

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create bands table
CREATE TABLE public.bands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create songs table
CREATE TABLE public.songs (
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
CREATE TABLE public.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create setlist_songs (Many-to-Many relationship between events and songs)
CREATE TABLE public.setlist_songs (
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (event_id, song_id)
);

-- Indexes for performance
CREATE INDEX idx_songs_band_id ON public.songs(band_id);
CREATE INDEX idx_events_band_id ON public.events(band_id);
CREATE INDEX idx_setlist_songs_event_id ON public.setlist_songs(event_id);
CREATE INDEX idx_setlist_songs_song_id ON public.setlist_songs(song_id);