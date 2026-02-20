import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const DATA_FILE = join(process.cwd(), 'data', 'tasks.json');

function loadTasks() {
  if (!existsSync(DATA_FILE)) return [];
  return JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
}

function saveTasks(tasks) {
  writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2));
}

export async function GET(request, { params }) {
  const tasks = loadTasks();
  const task = tasks.find(t => t.id === params.id);
  
  if (!task) {
    return Response.json({ error: 'Task not found' }, { status: 404 });
  }
  
  return Response.json({ task });
}

export async function PATCH(request, { params }) {
  const tasks = loadTasks();
  const idx = tasks.findIndex(t => t.id === params.id);
  
  if (idx === -1) {
    return Response.json({ error: 'Task not found' }, { status: 404 });
  }
  
  const body = await request.json();
  tasks[idx] = { ...tasks[idx], ...body };
  saveTasks(tasks);
  
  return Response.json({ success: true, task: tasks[idx] });
}
