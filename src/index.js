import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { supabase } from './supabase';
import Auth from './Auth';
import App from './App';

// Hardcoded team ID — avoids extra DB query on load
const TEAM_ID = 'bca245a1-cb3d-45db-aa81-128a5c617e50';

function Root() {
  const [state, setState] = useState('loading'); // 'loading' | 'auth' | 'ready'
  const [user, setUser]   = useState(null);

  async function ensureTeamMember(userId) {
    try {
      await supabase
        .from('team_members')
        .upsert(
          { team_id: TEAM_ID, user_id: userId },
          { onConflict: 'team_id,user_id', ignoreDuplicates: true }
        );
    } catch (err) {
      console.error('ensureTeamMember error:', err);
    }
  }

  useEffect(() => {
    // Only use onAuthStateChange — avoids the getSession() + onAuthStateChange
    // lock conflict that was causing the infinite loading screen
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session && session.user) {
        setUser(session.user);
        await ensureTeamMember(session.user.id);
        setState('ready');
      } else {
        setUser(null);
        setState('auth');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
