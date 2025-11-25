import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest, isSuperAdmin } from '@/lib/middleware/auth';
import { hashPassword } from '@/lib/auth';
import { z } from 'zod';

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Super Admin bypass or check for admin:users permission
    if (!isSuperAdmin(user) && !user.permissions.includes('admin:users')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const data = resetPasswordSchema.parse(body);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { userId: params.id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Hash new password
    const passwordHash = await hashPassword(data.newPassword);

    // Update password
    await prisma.user.update({
      where: { userId: params.id },
      data: { passwordHash },
    });

    return NextResponse.json({
      message: 'Password reset successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}

