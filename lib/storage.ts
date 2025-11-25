import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import crypto from 'crypto';

// Save to public/uploads so files are accessible via URL
const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), 'public', 'uploads');

export async function ensureUploadDir(): Promise<void> {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

export async function saveFile(file: Buffer, filename: string): Promise<string> {
  await ensureUploadDir();
  const filepath = join(UPLOAD_DIR, filename);
  await writeFile(filepath, file);
  return filepath;
}

export function generateFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

export function generateUniqueFilename(originalFilename: string): string {
  const ext = getFileExtension(originalFilename);
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  return `${timestamp}-${random}.${ext}`;
}

// S3 storage functions (for future AWS integration)
export async function saveToS3(file: Buffer, filename: string): Promise<string> {
  // Placeholder for S3 integration
  // This would use AWS SDK to upload to S3
  throw new Error('S3 storage not yet implemented');
}

export function getS3Url(bucket: string, key: string): string {
  return `https://${bucket}.s3.amazonaws.com/${key}`;
}

