import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE =
  process.env.API_BASE ??
  process.env.NEXT_PUBLIC_API_BASE ??
  'http://localhost:8085';

export async function POST() {
  const token = cookies().get('humpline_id_token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
  }
  const response = await fetch(`${API_BASE}/api/admin/tick/run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  const body = await response.json().catch(() => null);
  return NextResponse.json(body ?? { status: response.status }, { status: response.status });
}
