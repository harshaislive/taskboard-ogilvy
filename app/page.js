'use client';
import { useEffect, useMemo, useState } from 'react';

const labels = { todo: 'To Do', in_progress: 'In Progress', done: 'Done', blocked: 'Blocked' };
const IST = 'Asia/Kolkata';

function parseDue(task) {
  const dueValue = task.due_at || task.due;
  if (!dueValue) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(dueValue)) {
    return new Date(`${dueValue}T18:00:00+05:30`);
  }
  return new Date(dueValue);
}

function formatDue(task) {
  const dueDate = parseDue(task);
  if (!dueDate || Number.isNaN(dueDate.getTime())) return 'No due date';

  const today = new Date();
  const nowIST = new Date(today.toLocaleString('en-US', { timeZone: IST }));
  const dueIST = new Date(dueDate.toLocaleString('en-US', { timeZone: IST }));

  const startNow = new Date(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate());
  const startDue = new Date(dueIST.getFullYear(), dueIST.getMonth(), dueIST.getDate());
  const dayDiff = Math.round((startDue - startNow) / 86400000);

  const human = new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: IST
  }).format(dueDate);

  if (dayDiff === 0) return `Today, ${human.split(',').slice(1).join(',').trim()} IST`;
  if (dayDiff === 1) return `Tomorrow, ${human.split(',').slice(1).join(',').trim()} IST`;
  if (dayDiff < 0) return `Overdue · ${human} IST`;
  return `${human} IST`;
}

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
        <button className="ghost" onClick={() => fetch('/api/logout', { method: 'POST' }).then(() => (window.location.href = '/login'))}>Sign out</button>
      </header>

      <section className="summary">
        <div><strong>{data.summary.total}</strong><span>Total</span></div>
        <div><strong>{data.summary.todo}</strong><span>To Do</span></div>
        <div><strong>{data.summary.in_progress}</strong><span>In Progress</span></div>
        <div><strong>{data.summary.done}</strong><span>Done</span></div>
      </section>

      <nav className="filters">
        {['all', 'todo', 'in_progress', 'blocked', 'done'].map((f) => (
          <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f === 'all' ? 'All' : labels[f]}</button>
        ))}
      </nav>

      <section className="list">
        {tasks.map((t) => (
          <article key={t.id} className="row">
            <div className="main">
              <h3>{t.title}</h3>
              <p>{t.owner}</p>
              <div className="due">Due: {formatDue(t)}</div>
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
