import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let r2Client: S3Client | null = null;

function getR2Client() {
  if (r2Client) {
    return r2Client;
  }

  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    return null;
  }

  r2Client = new S3Client({
    region: process.env.R2_REGION ?? "auto",
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });

  return r2Client;
}

export async function createSignedDownloadUrl(fileKey: string, expiresInSeconds = 600) {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET;

  if (!client || !bucket) {
    return null;
  }

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: fileKey
  });

  return getSignedUrl(client, command, {
    expiresIn: expiresInSeconds
  });
}

export function isR2Configured() {
  return Boolean(
    process.env.R2_ENDPOINT &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET
  );
}

export async function uploadR2Object(params: {
  fileKey: string;
  body: Uint8Array;
  contentType?: string | null;
}) {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET;

  if (!client || !bucket) {
    return null;
  }

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: params.fileKey,
      Body: params.body,
      ContentType: params.contentType ?? "application/octet-stream"
    })
  );

  return {
    bucket,
    key: params.fileKey
  };
}
