import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';
import Dashboard from './pages/Dashboard';
import StageViewer from './components/StageViewer';
import PracticeView from './components/PracticeView';
import SetlistPracticeView from './components/SetlistPracticeView';
import SharedSetlistView from './components/SharedSetlistView';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-white">Cargando...</div>;
  }

  return (
    <Router>
      {!session ? (
        <Auth setSession={setSession} />
      ) : (
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/stage/:id" element={<StageViewer />} />
          <Route path="/practice/:id" element={<PracticeView />} />
          <Route path="/practice/setlist/:id" element={<SetlistPracticeView />} />
          <Route path="/s/:token" element={<SharedSetlistView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </Router>
  );
}

export default App;
