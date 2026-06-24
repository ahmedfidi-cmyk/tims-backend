# ADR-0008 — Object storage for device documents (S3 presigned uploads)

| | |
|---|---|
| **Status** | Accepted (backend; real bucket/credentials are an ops follow-up) |
| **Date** | 2026-06-24 |
| **Decision owners** | Engineering + Owner |
| **Relates to** | [ADR-0003](./0003-inventory-imei-implementation.md) (device registration requires a supplier invoice) |

## Context

Device registration and KYC require documents (supplier invoice, customs clearance, IMEI
certificate, box photos). The `DeviceDocument` entity already records `s3Bucket`/`s3Key`/`sha256`
/`mimeType`/`sizeBytes`, and the inventory service exposes a presign seam
(`ObjectStoragePort.presignUpload`) plus `POST /lahtha/inventory/devices/:id/documents/upload-url`.
Until now the only adapter was `StubObjectStorage`, which returns a fake `*.s3.local` URL — and it
was **hardcoded into the production wiring**, so a real deployment would mint unusable upload URLs.

We have no S3 bucket or credentials in this environment, and we keep the dependency surface minimal
(no AWS SDK — the BNPL webhook HMAC is likewise hand-rolled on `node:crypto`).

## Decision

Add a real **`S3ObjectStorage`** adapter that returns **SigV4 presigned PUT URLs**, computed with
`node:crypto` only. The vendor's browser uploads bytes directly to S3; the backend never proxies
the file. Selection is config-driven and **fails closed**:

- `buildObjectStorage(config, clock)` chooses the adapter:
  - **S3** when `S3_BUCKET` + `S3_REGION` + `S3_ACCESS_KEY_ID` + `S3_SECRET_ACCESS_KEY` are all set
    (or `STORAGE_DRIVER=s3` is forced).
  - **Stub** outside production when S3 is not configured.
  - **In production a stub is refused** — `StorageNotConfiguredError` — rather than handing out
    presigned URLs that point nowhere.
- `STORAGE_DRIVER=s3` without full credentials also throws `StorageNotConfiguredError`.

### Addressing & signing

- **Virtual-hosted** by default: `https://{bucket}.s3.{region}.amazonaws.com/{key}`.
- **Path-style** when `S3_ENDPOINT` is set (MinIO / S3-compatible): `{endpoint}/{bucket}/{key}`.
- Query-string SigV4: `X-Amz-Algorithm=AWS4-HMAC-SHA256`, `X-Amz-Credential`, `X-Amz-Date`,
  `X-Amz-Expires` (default 900s, capped at 3600), `X-Amz-SignedHeaders=host`, payload
  `UNSIGNED-PAYLOAD`; `host` is the only signed header. The signing key is the standard
  `AWS4{secret} → date → region → s3 → aws4_request` HMAC chain.
- Keys are server-generated and collision-free:
  `devices/{deviceId}/{documentType}/{documentId}`.

## Consequences

- Presigned uploads work against real S3 (or any S3-compatible store) with zero new dependencies.
- The seam fails closed: a misconfigured production deploy errors loudly instead of silently
  issuing dead URLs.
- The signature is covered by a **golden-master** test (fixed clock + inputs) so the HMAC chain
  can't drift unnoticed; fail-closed selection is unit-tested.
- **Not yet done** (ops follow-ups): provision the bucket + IAM credentials; add a presign-GET
  (download) seam for admin/compliance document review; optionally sign `content-type`/size to
  constrain uploads; lifecycle/retention policy on the bucket. The web upload form is still mock —
  wiring it to request a presigned URL, PUT the file, then `POST …/documents` is a later slice.
