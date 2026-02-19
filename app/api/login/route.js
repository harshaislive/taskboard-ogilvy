import { cookies } from 'next/headers';

export async function POST(req) {
  const { passcode } = await req.json();
  if (!process.env.TASKS_PASSCODE) {
    return Response.json({ error: 'Server passcode not configured' }, { status: 500 });
  }
  if (passcode !== process.env.TASKS_PASSCODE) {
    return Response.json({ error: 'Invalid passcode' }, { status: 401 });
  }
  cookies().set('task_auth', 'ok', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 12,
    path: '/'
  });
  return Response.json({ ok: true });
}
