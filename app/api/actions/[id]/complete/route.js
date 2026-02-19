import { completeAction } from '@/lib/tasks';

export async function POST(req, { params }) {
  const token = req.headers.get('x-worker-token') || '';
  if (!process.env.TARS_WORKER_TOKEN || token !== process.env.TARS_WORKER_TOKEN) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const status = body.status || 'done';
  const result = body.result || '';
  const ok = await completeAction(params.id, status, result);
  return Response.json({ ok });
}
