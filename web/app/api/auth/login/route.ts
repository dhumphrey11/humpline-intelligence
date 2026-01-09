import { NextResponse } from 'next/server';

const COOKIE_NAME = 'humpline_id_token';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const idToken = body?.idToken as string | undefined;
  if (!idToken) {
    return NextResponse.json({ error: 'idToken required' }, { status: 400 });
  }

  const secure = process.env.NODE_ENV === 'production';
  const response = NextResponse.json({ status: 'ok' });
  response.cookies.set(COOKIE_NAME, idToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  });
  return response;
}
