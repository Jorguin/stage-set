-- RLS Policy Security Audit
-- Run this against your Supabase database to verify policies

-- ============================================================
-- 1. VERIFY ALL TABLES HAVE RLS ENABLED
-- ============================================================
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'bands', 'songs', 'events', 'setlist_songs', 
  'practice_sessions', 'song_section_progress', 
  'shared_setlists', 'event_collaborators'
)
ORDER BY tablename;

-- ============================================================
-- 2. LIST ALL POLICIES WITH DETAILS
-- ============================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN (
  'bands', 'songs', 'events', 'setlist_songs', 
  'practice_sessions', 'song_section_progress', 
  'shared_setlists', 'event_collaborators'
)
ORDER BY tablename, policyname;

-- ============================================================
-- 3. CHECK FOR OVERLY PERMISSIVE POLICIES (USING TRUE)
-- ============================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  'WARNING: Policy allows unrestricted access' as issue
FROM pg_policies 
WHERE schemaname = 'public'
AND (qual = 'true' OR qual ILIKE '%true%')
AND cmd IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL');

-- ============================================================
-- 4. VERIFY OWNER-BASED ACCESS (NO RECURSION)
-- ============================================================
-- Check policies that join through bands table (potential recursion)
SELECT 
  schemaname,
  tablename,
  policyname,
  qual
FROM pg_policies 
WHERE schemaname = 'public'
AND qual LIKE '%JOIN%bands%'
AND tablename != 'bands';

-- ============================================================
-- 5. CHECK event_collaborators FOR RECURSION RISK
-- ============================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  qual
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename = 'event_collaborators'
AND qual LIKE '%events%';

-- ============================================================
-- 6. VERIFY AUTH.UID() USAGE (NOT AUTH.USER_ID())
-- ============================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  qual,
  CASE WHEN qual LIKE '%auth.uid()%' THEN 'OK' ELSE 'CHECK: Uses non-standard function' END as check
FROM pg_policies 
WHERE schemaname = 'public'
AND qual IS NOT NULL;

-- ============================================================
-- 7. CHECK FOR MISSING WITH CHECK ON WRITE OPERATIONS
-- ============================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  with_check,
  CASE WHEN cmd IN ('INSERT', 'UPDATE', 'ALL') AND (with_check IS NULL OR with_check = '') 
       THEN 'WARNING: Missing WITH CHECK on write policy' 
       ELSE 'OK' END as check
FROM pg_policies 
WHERE schemaname = 'public';

-- ============================================================
-- 8. TEST POLICIES WITH SIMULATED USERS
-- ============================================================
-- Run as different users to verify isolation
-- SET ROLE authenticated;
-- SET request.jwt.claims TO '{"sub": "user-1-uuid"}';
-- SELECT * FROM songs; -- Should only see own bands' songs
-- RESET ROLE;