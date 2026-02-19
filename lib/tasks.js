import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { Pool } from 'pg';
import crypto from 'crypto';

let pool;
let initialized = false;

const runtimeFile = path.join(process.cwd(), 'data', 'runtime.json');

function readRuntime() {
  if (!fs.existsSync(runtimeFile)) {
    return { comments: [], actions: [] };
  }
  return JSON.parse(fs.readFileSync(runtimeFile, 'utf8'));
}

function writeRuntime(data) {
  fs.writeFileSync(runtimeFile, JSON.stringify(data, null, 2));
}

function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return pool;
}

function scoreTask(task) {
  const f = task.framework || {};
  const reach = Number(f.reach || 1);
  const impact = Number(f.impact || 1);
  const confidence = Number(f.confidence || 1);
  const effort = Number(f.effort || 1);
  const score = Number(((reach * impact * confidence) / Math.max(1, effort)).toFixed(2));
  return { ...task, framework: { reach, impact, confidence, effort }, score };
}

function summarize(tasks) {
  return {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === 'todo').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    done: tasks.filter((t) => t.status === 'done').length,
    blocked: tasks.filter((t) => t.status === 'blocked').length,
    topScore: tasks[0]?.score || 0
  };
}

function loadYamlTasks() {
  const file = path.join(process.cwd(), 'data', 'tasks.yaml');
  const raw = fs.readFileSync(file, 'utf8');
  const parsed = yaml.load(raw) || {};
  const tasks = (parsed.tasks || []).map(scoreTask).sort((a, b) => b.score - a.score);
  return { updated_at: parsed.updated_at, tasks, summary: summarize(tasks), source: 'yaml' };
}

async function ensureSchemaAndSeed() {
  const db = getPool();
  if (!db || initialized) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      due_at TIMESTAMPTZ,
      owner TEXT,
      reach INT NOT NULL DEFAULT 1,
      impact INT NOT NULL DEFAULT 1,
      confidence INT NOT NULL DEFAULT 1,
      effort INT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS task_comments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      author TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS task_actions (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      comment_id TEXT,
      command TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      result TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const { rows } = await db.query('SELECT COUNT(*)::int AS count FROM tasks');
  if ((rows[0]?.count || 0) === 0) {
    const yamlData = loadYamlTasks();
    for (const t of yamlData.tasks) {
      const dueVal = t.due_at || t.due || null;
      const dueAt = dueVal ? (/^\d{4}-\d{2}-\d{2}$/.test(dueVal) ? `${dueVal}T18:00:00+05:30` : dueVal) : null;
      await db.query(
        `INSERT INTO tasks (id,title,status,due_at,owner,reach,impact,confidence,effort)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
        [t.id, t.title, t.status, dueAt, t.owner || null, t.framework.reach, t.framework.impact, t.framework.confidence, t.framework.effort]
      );
    }
  }

  initialized = true;
}

async function loadDbTasks() {
  const db = getPool();
  if (!db) return null;
  await ensureSchemaAndSeed();

  const { rows } = await db.query(`
    SELECT id,title,status,due_at,owner,reach,impact,confidence,effort,updated_at
    FROM tasks
    ORDER BY ((reach*impact*confidence)::numeric/GREATEST(effort,1)) DESC, updated_at DESC
  `);

  const tasks = rows.map((r) => scoreTask({
    id: r.id,
    title: r.title,
    status: r.status,
    due_at: r.due_at ? new Date(r.due_at).toISOString() : null,
    owner: r.owner,
    framework: { reach: r.reach, impact: r.impact, confidence: r.confidence, effort: r.effort }
  }));

  return { updated_at: new Date().toISOString(), tasks, summary: summarize(tasks), source: 'postgres' };
}

export async function loadTasks() {
  try {
    const dbData = await loadDbTasks();
    if (dbData) return dbData;
  } catch (error) {
    console.error('DB load failed, falling back to YAML:', error?.message || error);
  }
  return loadYamlTasks();
}

function extractTarsCommand(body) {
  const m = body.match(/@TARS\s+([\s\S]+)/i);
  return m ? m[1].trim() : null;
}

export async function addComment(taskId, author, body) {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const cmd = extractTarsCommand(body);
  const db = getPool();

  try {
    if (db) {
      await ensureSchemaAndSeed();
      await db.query('INSERT INTO task_comments (id,task_id,author,body,created_at) VALUES ($1,$2,$3,$4,$5)', [id, taskId, author, body, createdAt]);
      if (cmd) {
        const aid = crypto.randomUUID();
        await db.query('INSERT INTO task_actions (id,task_id,comment_id,command,status,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$6)', [aid, taskId, id, cmd, 'queued', createdAt]);
      }
      return { id, task_id: taskId, author, body, created_at: createdAt };
    }
  } catch (e) {
    console.error('DB addComment failed, using runtime file', e?.message || e);
  }

  const rt = readRuntime();
  rt.comments.push({ id, task_id: taskId, author, body, created_at: createdAt });
  if (cmd) rt.actions.push({ id: crypto.randomUUID(), task_id: taskId, comment_id: id, command: cmd, status: 'queued', created_at: createdAt, updated_at: createdAt, result: null });
  writeRuntime(rt);
  return { id, task_id: taskId, author, body, created_at: createdAt };
}

export async function listComments(taskId) {
  const db = getPool();
  try {
    if (db) {
      await ensureSchemaAndSeed();
      const { rows } = await db.query('SELECT id,task_id,author,body,created_at FROM task_comments WHERE task_id=$1 ORDER BY created_at DESC LIMIT 100', [taskId]);
      return rows;
    }
  } catch (e) {
    console.error('DB listComments failed, using runtime file', e?.message || e);
  }
  return readRuntime().comments.filter((c) => c.task_id === taskId).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function claimNextAction() {
  const db = getPool();
  const now = new Date().toISOString();
  try {
    if (db) {
      await ensureSchemaAndSeed();
      const { rows } = await db.query(`
        UPDATE task_actions SET status='running', updated_at=$1
        WHERE id=(SELECT id FROM task_actions WHERE status='queued' ORDER BY created_at ASC LIMIT 1)
        RETURNING id,task_id,comment_id,command,status,created_at,updated_at
      `, [now]);
      return rows[0] || null;
    }
  } catch (e) {
    console.error('DB claimNextAction failed, using runtime file', e?.message || e);
  }

  const rt = readRuntime();
  const next = rt.actions.find((a) => a.status === 'queued');
  if (!next) return null;
  next.status = 'running';
  next.updated_at = now;
  writeRuntime(rt);
  return next;
}

export async function completeAction(actionId, status, result) {
  const db = getPool();
  const now = new Date().toISOString();
  try {
    if (db) {
      await ensureSchemaAndSeed();
      await db.query('UPDATE task_actions SET status=$2,result=$3,updated_at=$4 WHERE id=$1', [actionId, status, result || null, now]);
      return true;
    }
  } catch (e) {
    console.error('DB completeAction failed, using runtime file', e?.message || e);
  }
  const rt = readRuntime();
  const a = rt.actions.find((x) => x.id === actionId);
  if (!a) return false;
  a.status = status;
  a.result = result || null;
  a.updated_at = now;
  writeRuntime(rt);
  return true;
}
