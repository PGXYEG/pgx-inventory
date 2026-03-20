import { useState } from 'react';
import { supabase } from './supabase';

const C = {
  green: '#1a4a2e', greenLight: '#4a9e6a', sand: '#e4ddd0',
  white: '#ffffff', ink: '#1a1a14', inkFaint: '#9a9a88',
  red: '#8a2a2a', redPale: '#fdf0f0',
};
const FONTS = {
  display: "'Playfair Display', Georgia, serif",
  sans: "'Instrument Sans', 'Trebuchet MS', sans-serif",
};
const inputSt = {
  width: '100%', padding: '10px 13px',
  background: C.white, border: '1.5px solid ' + C.sand,
  borderRadius: 7, fontSize: 14, color: C.ink,
  fontFamily: FONTS.sans, outline: 'none', marginBottom: 14,
  boxSizing: 'border-box',
};

export default function Auth() {
  const [mode, setMode]         = useState('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [message, setMessage]   = useState(null);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage({ type: 'error', text: error.message });
    setLoading(false);
  }

  async function handleSignup(e) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setMessage({ type: 'error', text: error.message });
    else setMessage({ type: 'success', text: 'Check your email for a confirmation link, then come back and log in.' });
    setLoading(false);
  }

  async function handleReset(e) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://pgx-inventory.vercel.app',
    });
    if (error) setMessage({ type: 'error', text: error.message });
    else setMessage({ type: 'success', text: 'Password reset email sent — check your inbox.' });
    setLoading(false);
  }

  return (
    <div style={{ minHeight: '100vh', background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONTS.sans, padding: 24 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Instrument+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      <div style={{ background: C.white, borderRadius: 14, padding: '40px 36px', width: '100%', maxWidth: 400, boxShadow: '0 32px 80px rgba(0,0,0,.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>⛳</div>
          <div style={{ fontFamily: FONTS.display, fontSize: 24, fontWeight: 700, color: C.green }}>PGX</div>
          <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: C.inkFaint, marginTop: 2 }}>Event Inventory Manager</div>
        </div>

        {mode !== 'reset' && (
          <div style={{ display: 'flex', marginBottom: 24, borderRadius: 8, overflow: 'hidden', border: '1.5px solid ' + C.sand }}>
            {['login', 'signup'].map(m => (
              <button key={m} onClick={() => { setMode(m); setMessage(null); }}
                style={{ flex: 1, padding: '9px 0', fontSize: 13, fontFamily: FONTS.sans, fontWeight: 600, cursor: 'pointer', border: 'none', background: mode === m ? C.green : C.white, color: mode === m ? C.white : C.inkFaint }}>
                {m === 'login' ? 'Log In' : 'Sign Up'}
              </button>
            ))}
          </div>
        )}

        {message && (
          <div style={{ background: message.type === 'error' ? C.redPale : '#e8f2ec', color: message.type === 'error' ? C.red : C.green, border: '1px solid ' + (message.type === 'error' ? '#e8c0c0' : '#b8d9c4'), borderRadius: 7, padding: '10px 14px', fontSize: 13, marginBottom: 18 }}>
            {message.text}
          </div>
        )}

        <form onSubmit={mode === 'login' ? handleLogin : mode === 'signup' ? handleSignup : handleReset}>
          {mode === 'reset' && (
            <div style={{ fontSize: 13, color: C.inkFaint, marginBottom: 18 }}>Enter your email and we'll send you a reset link.</div>
          )}
          <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required style={inputSt} />
          {mode !== 'reset' && (
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={{ ...inputSt, marginBottom: 20 }} />
          )}
          <button type="submit" disabled={loading}
            style={{ width: '100%', background: C.green, color: C.white, border: 'none', borderRadius: 7, padding: '11px 0', fontSize: 14, fontFamily: FONTS.sans, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? '…' : mode === 'login' ? 'Log In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: C.inkFaint }}>
          {mode === 'reset'
            ? <span style={{ cursor: 'pointer', color: C.green }} onClick={() => { setMode('login'); setMessage(null); }}>← Back to login</span>
            : <span style={{ cursor: 'pointer', color: C.green }} onClick={() => { setMode('reset'); setMessage(null); }}>Forgot password?</span>
          }
        </div>
      </div>
    </div>
  );
}
