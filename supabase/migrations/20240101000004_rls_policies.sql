-- 20240101000004_rls_policies.sql
-- Row Level Security policies

-- Enable RLS on all tables
ALTER TABLE public.bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setlist_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_section_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_setlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_collaborators ENABLE ROW LEVEL SECURITY;

-- Policies for bands (owner-based only)
CREATE POLICY "Users can view their own bands"
    ON public.bands FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert their own bands"
    ON public.bands FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update their own bands"
    ON public.bands FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete their own bands"
    ON public.bands FOR DELETE USING (auth.uid() = owner_id);

-- Policies for songs (owner through band)
CREATE POLICY "Users can manage songs of their bands"
    ON public.songs FOR ALL
    USING (EXISTS (SELECT 1 FROM public.bands WHERE bands.id = songs.band_id AND bands.owner_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.bands WHERE bands.id = songs.band_id AND bands.owner_id = auth.uid()));

-- Policies for events (owner through band)
CREATE POLICY "Users can manage events of their bands"
    ON public.events FOR ALL
    USING (EXISTS (SELECT 1 FROM public.bands WHERE bands.id = events.band_id AND bands.owner_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.bands WHERE bands.id = events.band_id AND bands.owner_id = auth.uid()));

-- Policies for setlist_songs (owner through event -> band)
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

-- Policies for practice_sessions (user owns their sessions)
CREATE POLICY "Users can manage their practice sessions"
    ON public.practice_sessions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policies for song_section_progress (user owns their progress)
CREATE POLICY "Users can manage their section progress"
    ON public.song_section_progress FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policies for shared_setlists (owner manages, public reads via token)
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

-- Public read access for shared links (via token) - anyone with token can read
CREATE POLICY "Public read shared links" ON public.shared_setlists
    FOR SELECT USING (true);

-- Policies for event_collaborators (NO recursion - owner manages via invited_by)
CREATE POLICY "Owner manages collaborators"
    ON public.event_collaborators FOR ALL
    USING (auth.uid() = invited_by)
    WITH CHECK (auth.uid() = invited_by);

-- Collaborator sees own row
CREATE POLICY "Collaborator sees own row" ON public.event_collaborators
    FOR SELECT USING (user_id = auth.uid());