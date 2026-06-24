import { describe, it, expect } from 'vitest';
import { S3ObjectStorage, StorageNotConfiguredError } from '../src/domains/lahtha/inventory/s3-storage.js';
import { buildObjectStorage } from '../src/domains/lahtha/inventory/index.js';
import { FixedClock, StubObjectStorage } from '../src/domains/lahtha/inventory/in-memory-adapters.js';
import type { Config } from '../src/config/index.js';

const clock = new FixedClock(new Date('2026-06-24T12:00:00.000Z'));
const cfg = {
  bucket: 'lahtha-device-docs',
  region: 'me-central-1',
  accessKeyId: 'AKIAEXAMPLE',
  secretAccessKey: 'secret-key-value',
};
const args = {
  deviceId: 'dev-1',
  documentId: 'doc-1',
  documentType: 'supplier_invoice' as const,
  contentType: 'application/pdf',
};

function baseConfig(over: Partial<Config>): Config {
  return { NODE_ENV: 'development', ...over } as unknown as Config;
}

describe('S3ObjectStorage (SigV4 presigned PUT)', () => {
  it('builds a virtual-hosted presigned URL with all SigV4 query params', async () => {
    const p = await new S3ObjectStorage(cfg, clock).presignUpload(args);
    const u = new URL(p.url);
    expect(u.host).toBe('lahtha-device-docs.s3.me-central-1.amazonaws.com');
    expect(u.pathname).toBe('/devices/dev-1/supplier_invoice/doc-1');
    expect(u.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(u.searchParams.get('X-Amz-Credential')).toBe(
      'AKIAEXAMPLE/20260624/me-central-1/s3/aws4_request',
    );
    expect(u.searchParams.get('X-Amz-Date')).toBe('20260624T120000Z');
    expect(u.searchParams.get('X-Amz-Expires')).toBe('900');
    expect(u.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
    // Golden master: locks the SigV4 HMAC chain against accidental change.
    expect(u.searchParams.get('X-Amz-Signature')).toBe(
      'fa28a84e98072251d122333397baed2e61d7d5ae495c7cc1e32cc52e728a50d9',
    );
    expect(p.bucket).toBe('lahtha-device-docs');
    expect(p.key).toBe('devices/dev-1/supplier_invoice/doc-1');
    expect(p.expiresAt.toISOString()).toBe('2026-06-24T12:15:00.000Z');
  });

  it('is deterministic for fixed inputs but varies with the signing secret', async () => {
    const a = await new S3ObjectStorage(cfg, clock).presignUpload(args);
    const b = await new S3ObjectStorage(cfg, clock).presignUpload(args);
    const c = await new S3ObjectStorage({ ...cfg, secretAccessKey: 'other-secret' }, clock).presignUpload(args);
    const sig = (url: string) => new URL(url).searchParams.get('X-Amz-Signature');
    expect(sig(a.url)).toBe(sig(b.url));
    expect(sig(a.url)).not.toBe(sig(c.url));
  });

  it('uses path-style addressing for a custom endpoint (MinIO etc.)', async () => {
    const p = await new S3ObjectStorage({ ...cfg, endpoint: 'http://minio:9000' }, clock).presignUpload(args);
    const u = new URL(p.url);
    expect(u.protocol).toBe('http:');
    expect(u.host).toBe('minio:9000');
    expect(u.pathname).toBe('/lahtha-device-docs/devices/dev-1/supplier_invoice/doc-1');
    expect(u.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('honours a custom expiry', async () => {
    const p = await new S3ObjectStorage({ ...cfg, expiresSeconds: 300 }, clock).presignUpload(args);
    expect(new URL(p.url).searchParams.get('X-Amz-Expires')).toBe('300');
    expect(p.expiresAt.toISOString()).toBe('2026-06-24T12:05:00.000Z');
  });
});

describe('buildObjectStorage (fail-closed selection)', () => {
  it('returns the dev stub outside production when S3 is unconfigured', () => {
    const s = buildObjectStorage(baseConfig({}), clock);
    expect(s).toBeInstanceOf(StubObjectStorage);
  });

  it('refuses a stub in production (fails closed)', () => {
    expect(() => buildObjectStorage(baseConfig({ NODE_ENV: 'production' }), clock)).toThrow(
      StorageNotConfiguredError,
    );
  });

  it('refuses driver=s3 without full credentials', () => {
    expect(() =>
      buildObjectStorage(baseConfig({ STORAGE_DRIVER: 's3', S3_BUCKET: 'b', S3_REGION: 'r' }), clock),
    ).toThrow(StorageNotConfiguredError);
  });

  it('builds an S3 adapter when fully configured', () => {
    const s = buildObjectStorage(
      baseConfig({
        NODE_ENV: 'production',
        S3_BUCKET: 'b',
        S3_REGION: 'me-central-1',
        S3_ACCESS_KEY_ID: 'AKIA',
        S3_SECRET_ACCESS_KEY: 'sk',
      }),
      clock,
    );
    expect(s).toBeInstanceOf(S3ObjectStorage);
  });
});
