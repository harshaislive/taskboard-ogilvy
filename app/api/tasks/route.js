import { loadTasks } from '@/lib/tasks';

export async function GET() {
  return Response.json(loadTasks());
}
