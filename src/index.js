import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { supabase } from './supabase';
import Auth from './Auth';
import App from './App';

const TEAM_ID = 'bca245a1-cb3d-45db-aa81-128a5c617e50';

function Root() {
  const [state, setState] = useState('loading');
  const [user, setUser]   = useState(null);

  async function ensureTeamMember(userId) {
    try {
      await supabase.from('team_members').upsert(
        { team_id: TEAM_ID, user_id: userId },
        { onConflict: 'team_id,user_id', ignoreDuplicates: true }
      );
    } catch (err) {
      console.error('ensureTeamMember error:', err);
    }
  }

  useEffect(() => {
    // Hard timeout — if nothing resolves in 4 seconds, show login screen
    const timeout = setTimeout(() => {
      setState(s => s === 'loading' ? 'auth' : s);
    }, 4000);

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      clearTimeout(timeout);
      if (session && session.user) {
        setUser(session.user);
        await ensureTeamMember(session.user.id);
        setState('ready');
      } else {
        setState('auth');
      }
    }).catch(() => {
      clearTimeout(timeout);
      setState('auth');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session && session.user) {
        setUser(session.user);
        await ensureTeamMember(session.user.id);
        setState('ready');
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setState('auth');
      }
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
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
