'use client';
import { useEffect, useMemo, useState } from 'react';

const labels = { todo: 'To Do', in_progress: 'In Progress', done: 'Done', blocked: 'Blocked' };

export default function HomePage() {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch('/api/tasks').then((r) => r.json()).then(setData);
  }, []);

  const tasks = useMemo(() => {
    if (!data) return [];
    if (filter === 'all') return data.tasks;
    return data.tasks.filter((t) => t.status === filter);
  }, [data, filter]);

  if (!data) return <main className="wrap"><p>Loading…</p></main>;

  return (
    <main className="wrap">
      <header className="top">
        <h1>Taskboard</h1>
        <button className="ghost" onClick={() => fetch('/api/logout', { method: 'POST' }).then(()=>window.location.href='/login')}>Sign out</button>
      </header>

      <section className="summary">
        <div><strong>{data.summary.total}</strong><span>Total</span></div>
        <div><strong>{data.summary.todo}</strong><span>To Do</span></div>
        <div><strong>{data.summary.in_progress}</strong><span>In Progress</span></div>
        <div><strong>{data.summary.done}</strong><span>Done</span></div>
      </section>

      <nav className="filters">
        {['all','todo','in_progress','blocked','done'].map((f) => (
          <button key={f} className={filter===f?'on':''} onClick={()=>setFilter(f)}>{f==='all'?'All':labels[f]}</button>
        ))}
      </nav>

      <section className="list">
        {tasks.map((t) => (
          <article key={t.id} className="row">
            <div className="main">
              <h3>{t.title}</h3>
              <p>{t.owner} · Due {t.due}</p>
            </div>
            <div className="meta">
              <span className="status">{labels[t.status]}</span>
              <span className="score">Score {t.score}</span>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
