'use client';
import { useEffect, useMemo, useState } from 'react';

const labels = { todo: 'To Do', in_progress: 'In Progress', done: 'Done', blocked: 'Blocked' };
const statusColors = { todo: '#f59e0b', in_progress: '#3b82f6', done: '#10b981', blocked: '#ef4444' };
const IST = 'Asia/Kolkata';

function parseDue(task) {
  const dueValue = task.due_at || task.due;
  if (!dueValue) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dueValue)) return new Date(`${dueValue}T18:00:00+05:30`);
  return new Date(dueValue);
}

function formatDue(task) {
  const dueDate = parseDue(task);
  if (!dueDate || Number.isNaN(dueDate.getTime())) return 'No due date';

  const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: IST }));
  const dueIST = new Date(dueDate.toLocaleString('en-US', { timeZone: IST }));
  const dayDiff = Math.round((new Date(dueIST.getFullYear(), dueIST.getMonth(), dueIST.getDate()) - new Date(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate())) / 86400000);

  const human = new Intl.DateTimeFormat('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: IST
  }).format(dueDate);

  if (dayDiff === 0) return `Today, ${human.split(',').slice(1).join(',').trim()}`;
  if (dayDiff === 1) return `Tomorrow, ${human.split(',').slice(1).join(',').trim()}`;
  if (dayDiff < 0) return `Overdue`;
  return human.split(',').slice(1).join(',').trim();
}

export default function HomePage() {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('list'); // 'list' or 'board'
  const [activeTask, setActiveTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentBody, setCommentBody] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetch('/api/tasks').then((r) => r.json()).then(setData);
  }, [refreshKey]);

  async function openTask(task) {
    setActiveTask(task);
    const res = await fetch(`/api/tasks/${task.id}/comments`);
    const j = await res.json();
    setComments(j.comments || []);
  }

  async function updateTaskStatus(taskId, newStatus) {
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    setRefreshKey(k => k + 1);
    if (activeTask?.id === taskId) {
      setActiveTask({ ...activeTask, status: newStatus });
    }
  }

  async function postComment(e) {
    e.preventDefault();
    if (!activeTask || !commentBody.trim()) return;
    const res = await fetch(`/api/tasks/${activeTask.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: 'Harsha', body: commentBody.trim() })
    });
    if (!res.ok) return;
    setCommentBody('');
    openTask(activeTask);
  }

  const tasks = useMemo(() => {
    if (!data) return [];
    if (filter === 'all') return data.tasks;
    return data.tasks.filter((t) => t.status === filter);
  }, [data, filter]);

  // Group tasks by status for Kanban
  const tasksByStatus = useMemo(() => {
    if (!data) return {};
    const groups = { todo: [], in_progress: [], blocked: [], done: [] };
    data.tasks.forEach(t => {
      if (groups[t.status]) groups[t.status].push(t);
    });
    return groups;
  }, [data]);

  if (!data) return <main className="wrap"><p className="loading">Loading…</p></main>;

  return (
    <main className="wrap">
      <header className="top">
        <h1>Taskboard</h1>
        <div className="headerActions">
          <div className="viewToggle">
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </button>
            <button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="10" rx="1"/></svg>
            </button>
          </div>
          <button className="ghost" onClick={() => fetch('/api/logout', { method: 'POST' }).then(() => (window.location.href = '/login'))}>Sign out</button>
        </div>
      </header>

      <section className="summary">
        <div><strong>{data.summary.total}</strong><span>Total</span></div>
        <div><strong>{data.summary.todo}</strong><span>To Do</span></div>
        <div><strong>{data.summary.in_progress}</strong><span>In Progress</span></div>
        <div><strong>{data.summary.done}</strong><span>Done</span></div>
      </section>

      {view === 'list' ? (
        <>
          <nav className="filters">
            {['all', 'todo', 'in_progress', 'blocked', 'done'].map((f) => (
              <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f === 'all' ? 'All' : labels[f]}</button>
            ))}
          </nav>

          <section className="list">
            {tasks.length === 0 ? <p className="empty">No tasks found</p> : tasks.map((t) => (
              <article key={t.id} className="row" onClick={() => openTask(t)}>
                <div className="main">
                  <h3>{t.title}</h3>
                  <p>{t.owner}</p>
                  <div className="due" data-overdue={parseDue(t) && parseDue(t) < new Date()}>📅 {formatDue(t)}</div>
                </div>
                <div className="meta">
                  <span className="status" style={{ background: statusColors[t.status] + '20', color: statusColors[t.status] }}>{labels[t.status]}</span>
                  <span className="score">#{t.score}</span>
                </div>
              </article>
            ))}
          </section>
        </>
      ) : (
        <section className="board">
          {['todo', 'in_progress', 'blocked', 'done'].map(status => (
            <div key={status} className="boardColumn">
              <div className="columnHeader">
                <span className="columnDot" style={{ background: statusColors[status] }}></span>
                <span>{labels[status]}</span>
                <span className="columnCount">{tasksByStatus[status]?.length || 0}</span>
              </div>
              <div className="columnContent">
                {(tasksByStatus[status] || []).map(t => (
                  <article key={t.id} className="boardCard" onClick={() => openTask(t)}>
                    <h4>{t.title}</h4>
                    <p>{t.owner}</p>
                    <div className="cardFooter">
                      <span className="due">📅 {formatDue(t)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {activeTask && (
        <section className="commentsPanel">
          <div className="commentsHeader">
            <h2>{activeTask.title}</h2>
            <button className="ghost closeBtn" onClick={() => setActiveTask(null)}>✕</button>
          </div>
          <div className="taskStatusBar">
            <span>Status:</span>
            <select value={activeTask.status} onChange={(e) => updateTaskStatus(activeTask.id, e.target.value)}>
              {Object.entries(labels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="commentsList">
            {comments.length === 0 ? <p className="emptyComments">No comments yet</p> : comments.map((c) => (
              <div key={c.id} className="commentItem" data-author={c.author}>
                <div className="commentMeta"><strong>{c.author}</strong> · {new Date(c.created_at).toLocaleString('en-IN', { timeZone: IST, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                <div className="commentBody">{c.body}</div>
              </div>
            ))}
          </div>
          <form onSubmit={postComment} className="commentForm">
            <input value={commentBody} onChange={(e) => setCommentBody(e.target.value)} placeholder="Add note or @TARS command..." />
            <button type="submit">Post</button>
          </form>
        </section>
      )}
    </main>
  );
}
