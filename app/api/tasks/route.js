import { loadTasks } from '@/lib/tasks';

export async function GET() {
  const data = await loadTasks();
  return Response.json(data);
}
