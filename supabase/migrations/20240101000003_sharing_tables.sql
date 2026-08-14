-- 20240101000003_sharing_tables.sql
-- Sharing & collaboration tables: shared_setlists, event_collaborators

-- Shared setlists (read-only links)
CREATE TABLE public.shared_setlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
    permissions TEXT DEFAULT 'read', -- 'read' | 'comment'
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Event collaborators (registered users)
CREATE TABLE public.event_collaborators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor', 'admin')),
    invited_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(event_id, user_id)
);

-- Indexes for performance
CREATE INDEX idx_shared_setlists_event_id ON public.shared_setlists(event_id);
CREATE INDEX idx_shared_setlists_token ON public.shared_setlists(token);
CREATE INDEX idx_event_collaborators_event_id ON public.event_collaborators(event_id);
CREATE INDEX idx_event_collaborators_user_id ON public.event_collaborators(user_id);