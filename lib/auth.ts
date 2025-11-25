import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export interface JWTPayload {
  userId: string;
  email: string;
  organizationId: string;
  roles: string[];
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

export function generateRefreshToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
  });
}

export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export async function storeRefreshToken(userId: string, token: string): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  const tokenHash = await hashPassword(token);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });
}

export async function validateRefreshToken(token: string, userId: string): Promise<boolean> {
  const tokens = await prisma.refreshToken.findMany({
    where: {
      userId,
      expiresAt: {
        gt: new Date(),
      },
    },
  });

  for (const storedToken of tokens) {
    if (await verifyPassword(token, storedToken.tokenHash)) {
      return true;
    }
  }

  return false;
}

export async function revokeRefreshToken(token: string, userId: string): Promise<void> {
  const tokens = await prisma.refreshToken.findMany({
    where: {
      userId,
      expiresAt: {
        gt: new Date(),
      },
    },
  });

  for (const storedToken of tokens) {
    if (await verifyPassword(token, storedToken.tokenHash)) {
      await prisma.refreshToken.delete({
        where: {
          tokenId: storedToken.tokenId,
        },
      });
      return;
    }
  }
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({
    where: {
      userId,
    },
  });
}

export async function getUserWithRoles(userId: string) {
  return prisma.user.findUnique({
    where: { userId },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
      organization: true,
    },
  });
}

