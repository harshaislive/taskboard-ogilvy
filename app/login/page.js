'use client';
import { useState } from 'react';

export default function LoginPage() {
  const [passcode, setPasscode] = useState('');
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode })
    });
    if (!res.ok) {
      const j = await res.json();
      setErr(j.error || 'Login failed');
      return;
    }
    window.location.href = '/';
  };

  return (
    <main className="wrap login">
      <form className="panel" onSubmit={submit}>
        <h1>Taskboard Access</h1>
        <p>Enter passcode to continue.</p>
        <input type="password" value={passcode} onChange={(e)=>setPasscode(e.target.value)} placeholder="Passcode" required />
        {err && <div className="err">{err}</div>}
        <button type="submit">Unlock</button>
      </form>
    </main>
  );
}
