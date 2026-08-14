-- 20240101000005_functions_storage.sql
-- Functions and storage configuration

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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.increment_mastery(UUID, UUID) TO authenticated;

-- Setup Storage for attachments
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