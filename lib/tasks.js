import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export function loadTasks() {
  const file = path.join(process.cwd(), 'data', 'tasks.yaml');
  const raw = fs.readFileSync(file, 'utf8');
  const parsed = yaml.load(raw) || {};
  const tasks = (parsed.tasks || []).map((t) => {
    const f = t.framework || {};
    const reach = Number(f.reach || 1);
    const impact = Number(f.impact || 1);
    const confidence = Number(f.confidence || 1);
    const effort = Number(f.effort || 1);
    const score = Number(((reach * impact * confidence) / Math.max(1, effort)).toFixed(2));
    return { ...t, framework: { reach, impact, confidence, effort }, score };
  });

  tasks.sort((a, b) => b.score - a.score);

  const summary = {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === 'todo').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    done: tasks.filter((t) => t.status === 'done').length,
    blocked: tasks.filter((t) => t.status === 'blocked').length,
    topScore: tasks[0]?.score || 0
  };

  return { updated_at: parsed.updated_at, tasks, summary };
}
