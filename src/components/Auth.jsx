import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { LogIn, Mail } from 'lucide-react';

export default function Auth({ setSession }) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [setSession]);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
      });
      if (error) throw error;
    } catch (error) {
      alert(error.error_description || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOtp({
        email,
      });
      if (error) throw error;
      setMessage('¡Revisa tu correo! Te hemos enviado un Magic Link para entrar.');
    } catch (error) {
      alert(error.error_description || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="bg-panel p-8 rounded-2xl shadow-xl w-full max-w-md text-center border border-gray-800">
        <h1 className="text-3xl font-bold text-white mb-2 tracking-wider">STAGE-SET</h1>
        <p className="text-gray-400 mb-8 text-sm">El visor de escenario manos libres para músicos en vivo</p>
        
        {message ? (
          <div className="bg-[#1A1A20] text-amber-400 p-4 rounded-xl border border-amber-400/30 mb-6">
            {message}
          </div>
        ) : (
          <form onSubmit={handleMagicLink} className="flex flex-col gap-4 mb-6">
            <input
              type="email"
              placeholder="tu@email.com"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#1A1A20] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-400 text-center"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-amber-400 text-black py-3 px-4 rounded-xl font-bold hover:bg-amber-500 transition-colors disabled:opacity-50"
            >
              <Mail size={20} />
              {loading ? 'Enviando...' : 'Entrar con Magic Link'}
            </button>
          </form>
        )}

        <div className="relative flex items-center py-4">
          <div className="flex-grow border-t border-gray-700"></div>
          <span className="flex-shrink-0 mx-4 text-gray-500 text-sm">O continúa con</span>
          <div className="flex-grow border-t border-gray-700"></div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="mt-4 w-full flex items-center justify-center gap-2 bg-white text-black py-3 px-4 rounded-xl font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
          <LogIn size={20} />
          Google
        </button>
      </div>
    </div>
  );
}
