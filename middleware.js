import { NextResponse } from 'next/server';

export function middleware(req) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname === '/login' || pathname.startsWith('/favicon')) {
    return NextResponse.next();
  }
  const authed = req.cookies.get('task_auth')?.value === 'ok';
  if (!authed) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
