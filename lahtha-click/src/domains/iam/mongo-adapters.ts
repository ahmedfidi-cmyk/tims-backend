// Mongoose + provider adapters for the IAM ports (production wiring).

import mongoose, { Schema, type Model } from 'mongoose';
import {
  MfaVerificationError,
  type AuditLogger,
  type MfaClaims,
  type MfaVerifierPort,
  type OtpChallenge,
  type OtpChallengeRepository,
  type OtpSenderPort,
  type Session,
  type SessionRepository,
  type VendorIdentity,
  type VendorIdentityRepository,
  type VendorStatusPort,
} from './types.js';
import type { OtpChannel } from './otp.js';
import type { Scope } from './scopes.js';
import { MongoVendorRepository } from '../lahtha/vendor/mongo-repositories.js';
import { canParticipateInClick } from '../lahtha/vendor/vendor-approval.js';

// --- Schemas ---

const identitySchema = new Schema<VendorIdentity>(
  {
    vendorId: { type: String, required: true, unique: true },
    businessName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    personId: { type: String, required: true },
    userId: { type: String, required: true },
    createdAt: { type: Date, required: true },
  },
  { collection: 'vendor_identities', versionKey: false },
);

const otpSchema = new Schema<OtpChallenge>(
  {
    challengeId: { type: String, required: true, unique: true },
    vendorId: { type: String, required: true },
    channel: { type: String, required: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, required: true, default: 0 },
    consumedAt: { type: Date, default: null },
    createdAt: { type: Date, required: true },
  },
  { collection: 'otp_challenges', versionKey: false },
);

const sessionSchema = new Schema<Session>(
  {
    sessionId: { type: String, required: true, unique: true },
    tokenHash: { type: String, required: true, unique: true },
    vendorId: { type: String, required: true },
    userId: { type: String, required: true },
    scopes: { type: [String], required: true },
    mfaVerified: { type: Boolean, required: true, default: false },
    device: { type: Schema.Types.Mixed, default: null },
    createdAt: { type: Date, required: true },
    idleExpiresAt: { type: Date, required: true },
    absoluteExpiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { collection: 'sessions', versionKey: false },
);

const IdentityModel: Model<VendorIdentity> =
  (mongoose.models.VendorIdentity as Model<VendorIdentity>) ??
  mongoose.model<VendorIdentity>('VendorIdentity', identitySchema);
const OtpModel: Model<OtpChallenge> =
  (mongoose.models.OtpChallenge as Model<OtpChallenge>) ??
  mongoose.model<OtpChallenge>('OtpChallenge', otpSchema);
const SessionModel: Model<Session> =
  (mongoose.models.Session as Model<Session>) ?? mongoose.model<Session>('Session', sessionSchema);

// --- Repositories ---

export class MongoVendorIdentityRepository implements VendorIdentityRepository {
  async create(identity: VendorIdentity): Promise<VendorIdentity> {
    const doc = await IdentityModel.create(identity);
    return strip(doc.toObject());
  }
  async findById(vendorId: string): Promise<VendorIdentity | null> {
    const doc = await IdentityModel.findOne({ vendorId }).lean<VendorIdentity>().exec();
    return doc ? strip(doc) : null;
  }
  async findByEmail(email: string): Promise<VendorIdentity | null> {
    const doc = await IdentityModel.findOne({ email }).lean<VendorIdentity>().exec();
    return doc ? strip(doc) : null;
  }
}

function strip(d: VendorIdentity): VendorIdentity {
  return {
    vendorId: d.vendorId,
    businessName: d.businessName,
    email: d.email,
    phone: d.phone,
    personId: d.personId,
    userId: d.userId,
    createdAt: d.createdAt,
  };
}

export class MongoOtpChallengeRepository implements OtpChallengeRepository {
  async create(challenge: OtpChallenge): Promise<OtpChallenge> {
    const doc = await OtpModel.create(challenge);
    return doc.toObject() as OtpChallenge;
  }
  async findActiveByVendor(vendorId: string): Promise<OtpChallenge | null> {
    return OtpModel.findOne({ vendorId, consumedAt: null })
      .sort({ createdAt: -1 })
      .lean<OtpChallenge>()
      .exec();
  }
  async incrementAttempts(challengeId: string): Promise<void> {
    await OtpModel.updateOne({ challengeId }, { $inc: { attempts: 1 } }).exec();
  }
  async markConsumed(challengeId: string, when: Date): Promise<void> {
    await OtpModel.updateOne({ challengeId }, { $set: { consumedAt: when } }).exec();
  }
}

export class MongoSessionRepository implements SessionRepository {
  async create(session: Session): Promise<Session> {
    const doc = await SessionModel.create(session);
    return doc.toObject() as Session;
  }
  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    return SessionModel.findOne({ tokenHash }).lean<Session>().exec();
  }
  async updateScopesAndMfa(sessionId: string, scopes: Scope[], mfaVerified: boolean): Promise<void> {
    await SessionModel.updateOne({ sessionId }, { $set: { scopes, mfaVerified } }).exec();
  }
  async touchIdleExpiry(sessionId: string, idleExpiresAt: Date): Promise<void> {
    await SessionModel.updateOne({ sessionId }, { $set: { idleExpiresAt } }).exec();
  }
  async revoke(sessionId: string, when: Date): Promise<void> {
    await SessionModel.updateOne({ sessionId }, { $set: { revokedAt: when } }).exec();
  }
}

/** Reads vendor approval state (Rule 4 gate) from the vendors collection. */
export class MongoVendorStatus implements VendorStatusPort {
  private readonly vendors = new MongoVendorRepository();
  async isApproved(vendorId: string): Promise<boolean> {
    const vendor = await this.vendors.findById(vendorId);
    return vendor ? canParticipateInClick(vendor.status) : false;
  }
}

/**
 * Phase-1 OTP "delivery": structured log only (no real SMS/email gateway wired).
 * The code is logged exclusively in non-production for local testing.
 */
export class LoggingOtpSender implements OtpSenderPort {
  constructor(
    private readonly logger: AuditLogger,
    private readonly exposeCode: boolean,
  ) {}
  async send(args: { vendorId: string; channel: OtpChannel; code: string }): Promise<void> {
    this.logger.info(
      {
        event: 'OTP_DISPATCHED',
        vendorId: args.vendorId,
        channel: args.channel,
        ...(this.exposeCode ? { code: args.code } : {}),
      },
      'otp dispatched',
    );
  }
}

/** Fails closed when no MFA provider is configured (no Entra credentials). */
export class DisabledMfaVerifier implements MfaVerifierPort {
  async verify(_idToken: string): Promise<MfaClaims> {
    throw new MfaVerificationError('MFA provider is not configured');
  }
}
