import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { supabase } from './supabase';
import Auth from './Auth';
import App from './App';

const TEAM_ID = 'bca245a1-cb3d-45db-aa81-128a5c617e50';

function Root() {
  const [state, setState] = useState('loading');
  const [user, setUser]   = useState(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && session.user) {
        setUser(session.user);
        setState('ready');
      } else {
        setUser(null);
        setState('auth');
      }
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line

  async function handleSignOut() {
    setState('loading');
    await supabase.auth.signOut();
  }

  if (state === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1a4a2e', color: '#faf8f4', fontSize: 18, fontFamily: 'Georgia, serif', gap: 12 }}>
        <span style={{ fontSize: 28 }}>⛳</span> Loading...
      </div>
    );
  }

  if (state === 'auth') return <Auth />;

  return <App user={user} teamId={TEAM_ID} onSignOut={handleSignOut} />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Root />);
