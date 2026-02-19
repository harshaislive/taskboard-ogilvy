import { cookies } from 'next/headers';

export async function POST() {
  cookies().delete('task_auth');
  return Response.json({ ok: true });
}
