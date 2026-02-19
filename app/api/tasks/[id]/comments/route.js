import { addComment, listComments } from '@/lib/tasks';

export async function GET(_req, { params }) {
  const comments = await listComments(params.id);
  return Response.json({ comments });
}

export async function POST(req, { params }) {
  const body = await req.json();
  const author = body.author || 'Harsha';
  const text = String(body.body || '').trim();
  if (!text) return Response.json({ error: 'Comment body required' }, { status: 400 });

  const comment = await addComment(params.id, author, text);
  return Response.json({ ok: true, comment });
}
