import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''
  });
}
