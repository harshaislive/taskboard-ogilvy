import { claimNextAction } from '@/lib/tasks';

export async function POST(req) {
  const token = req.headers.get('x-worker-token') || '';
  if (!process.env.TARS_WORKER_TOKEN || token !== process.env.TARS_WORKER_TOKEN) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const action = await claimNextAction();
  if (!action) return Response.json({ ok: true, action: null });
  return Response.json({ ok: true, action });
}
