import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { Pool } from 'pg';

let pool;
let initialized = false;

function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
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

  const { rows } = await db.query('SELECT COUNT(*)::int AS count FROM tasks');
  const count = rows[0]?.count || 0;

  if (count === 0) {
    const yamlData = loadYamlTasks();
    for (const t of yamlData.tasks) {
      const dueVal = t.due_at || t.due || null;
      let dueAt = null;
      if (dueVal) {
        dueAt = /^\d{4}-\d{2}-\d{2}$/.test(dueVal)
          ? `${dueVal}T18:00:00+05:30`
          : dueVal;
      }

      await db.query(
        `INSERT INTO tasks (id, title, status, due_at, owner, reach, impact, confidence, effort)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO NOTHING`,
        [
          t.id,
          t.title,
          t.status,
          dueAt,
          t.owner || null,
          t.framework.reach,
          t.framework.impact,
          t.framework.confidence,
          t.framework.effort
        ]
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
    SELECT id, title, status, due_at, owner, reach, impact, confidence, effort, updated_at
    FROM tasks
    ORDER BY ((reach * impact * confidence)::numeric / GREATEST(effort, 1)) DESC, updated_at DESC
  `);

  const tasks = rows.map((r) =>
    scoreTask({
      id: r.id,
      title: r.title,
      status: r.status,
      due_at: r.due_at ? new Date(r.due_at).toISOString() : null,
      owner: r.owner,
      framework: {
        reach: r.reach,
        impact: r.impact,
        confidence: r.confidence,
        effort: r.effort
      }
    })
  );

  return {
    updated_at: new Date().toISOString(),
    tasks,
    summary: summarize(tasks),
    source: 'postgres'
  };
}

export async function loadTasks() {
  const dbData = await loadDbTasks();
  if (dbData) return dbData;
  return loadYamlTasks();
}
