// Real object-storage adapter: S3 presigned PUT URLs via AWS Signature V4,
// implemented with node:crypto only (no AWS SDK) — same dependency-free posture
// as the BNPL webhook HMAC. The vendor's browser PUTs the file straight to S3
// with the returned URL; the backend never proxies bytes.
//
// Supports virtual-hosted-style (real AWS) and path-style (custom endpoint, e.g.
// MinIO / S3-compatible) addressing. Fails closed: without a bucket + region +
// credentials the factory refuses to build it.

import { createHash, createHmac } from 'node:crypto';
import type { Clock, DocumentType, ObjectStoragePort, PresignedUpload } from './types.js';

export interface S3StorageConfig {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Custom endpoint for S3-compatible stores (e.g. http://minio:9000). Path-style when set. */
  endpoint?: string;
  /** Presigned URL lifetime in seconds (default 900 = 15 min). */
  expiresSeconds?: number;
}

export class StorageNotConfiguredError extends Error {
  constructor() {
    super('Object storage is not configured (bucket/region/credentials required)');
    this.name = 'StorageNotConfiguredError';
  }
}

const SERVICE = 's3';
const ALGORITHM = 'AWS4-HMAC-SHA256';

function sha256Hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}
function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}
function signingKey(secret: string, dateStamp: string, region: string): Buffer {
  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, SERVICE);
  return hmac(kService, 'aws4_request');
}

/** RFC3986 percent-encoding as AWS SigV4 requires (unreserved: A-Za-z0-9-_.~). */
function awsUriEncode(input: string, encodeSlash: boolean): string {
  let out = '';
  for (const ch of Buffer.from(input, 'utf8')) {
    const c = String.fromCharCode(ch);
    if (/[A-Za-z0-9\-_.~]/.test(c)) out += c;
    else if (c === '/' && !encodeSlash) out += c;
    else out += `%${ch.toString(16).toUpperCase().padStart(2, '0')}`;
  }
  return out;
}

/** Two-digit-safe SigV4 timestamps: amzDate (YYYYMMDDTHHMMSSZ) + dateStamp (YYYYMMDD). */
function sigv4Timestamps(now: Date): { amzDate: string; dateStamp: string } {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
}

export class S3ObjectStorage implements ObjectStoragePort {
  constructor(private readonly config: S3StorageConfig, private readonly clock: Clock) {}

  async presignUpload(args: {
    deviceId: string;
    documentId: string;
    documentType: DocumentType;
    contentType: string;
  }): Promise<PresignedUpload> {
    const { bucket, region, accessKeyId, secretAccessKey, endpoint } = this.config;
    const expiresSeconds = this.config.expiresSeconds ?? 900;
    const key = `devices/${args.deviceId}/${args.documentType}/${args.documentId}`;

    const now = this.clock.now();
    const { amzDate, dateStamp } = sigv4Timestamps(now);
    const credentialScope = `${dateStamp}/${region}/${SERVICE}/aws4_request`;

    // Addressing: path-style for a custom endpoint, virtual-hosted for real AWS.
    let host: string;
    let baseUrl: string;
    let canonicalUri: string;
    const encodedKey = awsUriEncode(key, false);
    if (endpoint) {
      const u = new URL(endpoint);
      host = u.host;
      canonicalUri = `/${bucket}/${encodedKey}`;
      baseUrl = `${u.protocol}//${u.host}${canonicalUri}`;
    } else {
      host = `${bucket}.s3.${region}.amazonaws.com`;
      canonicalUri = `/${encodedKey}`;
      baseUrl = `https://${host}${canonicalUri}`;
    }

    // Canonical query (sorted by key; values URI-encoded). Host is the only signed header.
    const query: Array<[string, string]> = [
      ['X-Amz-Algorithm', ALGORITHM],
      ['X-Amz-Credential', `${accessKeyId}/${credentialScope}`],
      ['X-Amz-Date', amzDate],
      ['X-Amz-Expires', String(expiresSeconds)],
      ['X-Amz-SignedHeaders', 'host'],
    ];
    const canonicalQuery = query
      .map(([k, v]) => [awsUriEncode(k, true), awsUriEncode(v, true)] as const)
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    const canonicalRequest = [
      'PUT',
      canonicalUri,
      canonicalQuery,
      `host:${host}\n`,
      'host',
      'UNSIGNED-PAYLOAD',
    ].join('\n');

    const stringToSign = [ALGORITHM, amzDate, credentialScope, sha256Hex(canonicalRequest)].join('\n');
    const signature = hmac(signingKey(secretAccessKey, dateStamp, region), stringToSign).toString('hex');

    return {
      bucket,
      key,
      url: `${baseUrl}?${canonicalQuery}&X-Amz-Signature=${signature}`,
      expiresAt: new Date(now.getTime() + expiresSeconds * 1000),
    };
  }
}
