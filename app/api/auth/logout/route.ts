import { NextRequest, NextResponse } from 'next/server';
import { verifyRefreshToken, revokeRefreshToken } from '@/lib/auth';
import { z } from 'zod';

const logoutSchema = z.object({
  refreshToken: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { refreshToken } = logoutSchema.parse(body);

    if (refreshToken) {
      const payload = verifyRefreshToken(refreshToken);
      if (payload) {
        await revokeRefreshToken(refreshToken, payload.userId);
      }
    }

    return NextResponse.json({ message: 'Logged out successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

