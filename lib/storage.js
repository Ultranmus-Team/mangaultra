import { S3Client, PutObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

const REQUIRED_ENV = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const BUCKET = process.env.R2_BUCKET;
const PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, '') || null;

export const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export function publicUrlFor(storagePath) {
  if (!PUBLIC_BASE_URL) return null;
  return `${PUBLIC_BASE_URL}/${storagePath}`;
}

export async function uploadPage(buffer, storagePath, { quality = 80 } = {}) {
  let webpBuffer;
  try {
    webpBuffer = await sharp(buffer).webp({ quality }).toBuffer();
  } catch (err) {
    throw new Error(`Failed to convert image to WebP for ${storagePath}: ${err.message}`);
  }

  try {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: storagePath,
      Body: webpBuffer,
      ContentType: 'image/webp',
    }));
  } catch (err) {
    throw new Error(`Failed to upload ${storagePath} to R2: ${err.message}`);
  }

  return { storagePath, cdnUrl: publicUrlFor(storagePath) };
}

export async function deleteObjects(storagePaths) {
  if (!storagePaths || storagePaths.length === 0) {
    return { deleted: 0, errors: [] };
  }

  const BATCH_SIZE = 1000;
  let deleted = 0;
  const errors = [];

  for (let i = 0; i < storagePaths.length; i += BATCH_SIZE) {
    const batch = storagePaths.slice(i, i + BATCH_SIZE);
    try {
      const result = await s3.send(new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: {
          Objects: batch.map((Key) => ({ Key })),
          Quiet: true,
        },
      }));
      const batchErrors = result.Errors || [];
      deleted += batch.length - batchErrors.length;
      errors.push(...batchErrors);
    } catch (err) {
      throw new Error(`Failed to delete object batch from R2: ${err.message}`);
    }
  }

  if (errors.length > 0) {
    console.error('Some R2 objects failed to delete:', errors);
  }

  return { deleted, errors };
}
