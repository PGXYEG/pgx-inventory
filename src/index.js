import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { supabase } from './supabase';
import Auth from './Auth';
import App from './App';

function Root() {
  const [session, setSession] = useState(undefined);
  const [teamId, setTeamId]   = useState(null);

  async function ensureTeamMember(userId) {
    try {
      // Get the shared team
      const { data: teams, error: teamErr } = await supabase
        .from('team')
        .select('id')
        .limit(1);

      if (teamErr || !teams || teams.length === 0) {
        console.error('Could not find team:', teamErr);
        return null;
      }

      const tid = teams[0].id;

      // Add user to team if not already a member
      await supabase
        .from('team_members')
        .upsert({ team_id: tid, user_id: userId }, { onConflict: 'team_id,user_id', ignoreDuplicates: true });

      return tid;
    } catch (err) {
      console.error('ensureTeamMember error:', err);
      return null;
    }
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session) {
        const tid = await ensureTeamMember(session.user.id);
        setTeamId(tid);
      }
    });

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      if (session) {
        const tid = await ensureTeamMember(session.user.id);
        setTeamId(tid);
      } else {
        setTeamId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  // Still loading session
  if (session === undefined) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1a4a2e', color: '#faf8f4', fontSize: 18, fontFamily: 'Georgia, serif', gap: 12 }}>
        <span style={{ fontSize: 28 }}>⛳</span> Loading…
      </div>
    );
  }

  // Session exists but team not loaded yet
  if (session && !teamId) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1a4a2e', color: '#faf8f4', fontSize: 18, fontFamily: 'Georgia, serif', gap: 12 }}>
        <span style={{ fontSize: 28 }}>⛳</span> Loading…
      </div>
    );
  }

  // Not logged in
  if (!session) return <Auth />;

  // Logged in and team loaded
  return <App user={session.user} teamId={teamId} onSignOut={handleSignOut} />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Root />);
