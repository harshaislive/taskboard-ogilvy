import crypto from 'crypto';
import { addComment } from '@/lib/tasks';

function verifySignature(raw, signature) {
  const secret = process.env.TASK_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  return expected === signature;
}

export async function POST(req) {
  const raw = await req.text();
  const sig = req.headers.get('x-task-signature') || '';

  if (!verifySignature(raw, sig)) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event;
  try { event = JSON.parse(raw); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (event.type === 'comment.created' && event.task_id && event.body) {
    const comment = await addComment(String(event.task_id), event.author || 'System', String(event.body));
    return Response.json({ ok: true, comment });
  }

  return Response.json({ ok: true, ignored: true });
}
