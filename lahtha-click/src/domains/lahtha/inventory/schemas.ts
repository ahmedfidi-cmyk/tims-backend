// Zod schemas — the validation boundary for the inventory API.

import { z } from 'zod';
import { DEVICE_CONDITIONS, DOCUMENT_TYPES } from './types.js';
import { ACQUISITION_TYPES, OWNER_TYPES } from './device-state.js';

const imeiField = z.string().trim().regex(/^\d{15}$/, 'IMEI must be 15 digits');
const sha256Field = z.string().trim().regex(/^[0-9a-f]{64}$/i, 'sha256 must be 64 hex chars');

const documentInputSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES),
  s3Bucket: z.string().trim().min(1).max(256),
  s3Key: z.string().trim().min(1).max(1024),
  sha256: sha256Field,
  mimeType: z.string().trim().min(1).max(128),
  sizeBytes: z.number().int().positive(),
});

export const registerDeviceSchema = z.object({
  imei: imeiField,
  imei2: imeiField.optional(),
  serialNumber: z.string().trim().min(1).max(64),
  modelCode: z.string().trim().min(1).max(32),
  storageGb: z.number().int().positive().optional(),
  color: z.string().trim().min(1).max(64).optional(),
  condition: z.enum(DEVICE_CONDITIONS),
  // Mandatory proof at registration (rule 3): a supplier_invoice document.
  invoice: documentInputSchema.refine((d) => d.documentType === 'supplier_invoice', {
    message: 'registration requires a supplier_invoice document',
  }),
});
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;

export const addDocumentSchema = documentInputSchema;
export type AddDocumentInput = z.infer<typeof addDocumentSchema>;

export const presignSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES),
  contentType: z.string().trim().min(1).max(128),
});
export type PresignInput = z.infer<typeof presignSchema>;

export const transferSchema = z.object({
  newOwnerId: z.string().trim().min(1),
  newOwnerType: z.enum(OWNER_TYPES),
  acquisitionType: z.enum(ACQUISITION_TYPES),
  sourceEventId: z.string().trim().min(1).optional(),
});
export type TransferInput = z.infer<typeof transferSchema>;
