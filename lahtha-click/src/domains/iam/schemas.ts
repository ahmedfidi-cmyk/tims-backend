// Zod schemas — the validation boundary for the identity/session API.
// Controllers parse raw input through these before anything reaches a use case.

import { z } from 'zod';
import { OTP_CHANNELS } from './otp.js';

// E.164-ish phone (KSA + international). Kept permissive but structured.
const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[1-9]\d{7,14}$/, 'must be a valid E.164 phone number');

export const vendorRegistrationSchema = z.object({
  businessName: z.string().trim().min(2).max(200),
  email: z.string().trim().email().toLowerCase(),
  phone: phoneSchema,
  /** Principal to provision. Vendors are admin-approved; customers self-service. */
  principalType: z.enum(['vendor', 'customer']).default('vendor'),
  /** The human owner's name; defaults to the business name when omitted. */
  ownerFullName: z.string().trim().min(2).max(200).optional(),
  /** Optional national id — stored only as a hash by RBAC. */
  nationalId: z.string().trim().min(4).max(40).optional(),
});
export type VendorRegistrationInput = z.infer<typeof vendorRegistrationSchema>;

export const requestOtpSchema = z.object({
  vendorId: z.string().trim().min(1),
  channel: z.enum(OTP_CHANNELS).default('sms'),
});
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;

export const verifyOtpSchema = z.object({
  vendorId: z.string().trim().min(1),
  code: z.string().trim().regex(/^\d{6}$/, 'code must be 6 digits'),
  // Optional device fingerprint for session binding / audit.
  device: z
    .object({
      userAgent: z.string().trim().max(512).optional(),
      ip: z.string().trim().max(64).optional(),
    })
    .optional(),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

// MFA step-up: the client presents an OIDC ID token issued by Microsoft Entra.
export const stepUpMfaSchema = z.object({
  idToken: z.string().trim().min(1),
});
export type StepUpMfaInput = z.infer<typeof stepUpMfaSchema>;
