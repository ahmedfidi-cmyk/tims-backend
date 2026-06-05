// HTTP controllers for the IAM slice. Thin: parse + validate (zod), invoke a
// use case, map domain errors to status codes. All business rules live in the
// use cases; nothing here knows about Mongoose.

import { Router, type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import {
  requestOtpSchema,
  stepUpMfaSchema,
  vendorRegistrationSchema,
  verifyOtpSchema,
} from './schemas.js';
import {
  authenticate,
  IdentityConflictError,
  IdentityNotFoundError,
  logout,
  OtpError,
  registerVendorIdentity,
  requestOtp,
  SessionInvalidError,
  stepUpMfa,
  toSessionView,
  verifyOtpAndLogin,
  type IamDeps,
} from './use-cases.js';
import { hasScope, SCOPES, type Scope } from './scopes.js';
import { MfaVerificationError, type Session } from './types.js';

export const SESSION_COOKIE = 'lc_session';

export interface IamRouterOptions {
  /** Return the OTP code in the response + logs (local/dev only). */
  exposeDevCode: boolean;
  /** Set the Secure flag on the session cookie (true outside local http). */
  secureCookies: boolean;
}

declare module 'express-serve-static-core' {
  interface Request {
    iamSession?: Session;
  }
}

function bearerToken(req: Request): string | null {
  const auth = req.header('authorization');
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7).trim();
  const cookie = req.header('cookie');
  if (cookie) {
    for (const part of cookie.split(';')) {
      const eq = part.indexOf('=');
      if (eq === -1) continue;
      if (part.slice(0, eq).trim() === SESSION_COOKIE) {
        return decodeURIComponent(part.slice(eq + 1).trim());
      }
    }
  }
  return null;
}

function setSessionCookie(res: Response, token: string, maxAgeMs: number, secure: boolean): void {
  const attrs = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];
  if (secure) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function asyncHandler(
  deps: IamDeps,
  fn: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res).catch((err: unknown) => mapError(err, req, res, next));
  };
}

function mapError(err: unknown, req: Request, res: Response, next: NextFunction): void {
  const correlationId = req.correlationId;
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'validation_error', issues: err.issues, correlationId });
    return;
  }
  if (err instanceof IdentityConflictError) {
    res.status(409).json({ error: 'identity_conflict', message: err.message, correlationId });
    return;
  }
  if (err instanceof IdentityNotFoundError) {
    res.status(404).json({ error: 'identity_not_found', vendorId: err.vendorId, correlationId });
    return;
  }
  if (err instanceof OtpError) {
    res.status(401).json({ error: 'otp_rejected', reason: err.reason, correlationId });
    return;
  }
  if (err instanceof SessionInvalidError) {
    res.status(401).json({ error: 'session_invalid', reason: err.reason, correlationId });
    return;
  }
  if (err instanceof MfaVerificationError) {
    res.status(401).json({ error: 'mfa_failed', message: err.message, correlationId });
    return;
  }
  next(err);
}

export function createIamRouter(deps: IamDeps, opts: IamRouterOptions): Router {
  const router = Router();

  // Compose authn + scope check into a single middleware.
  function requireScope(scope: Scope) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const token = bearerToken(req);
      if (!token) {
        res.status(401).json({ error: 'unauthenticated', correlationId: req.correlationId });
        return;
      }
      authenticate(deps, token)
        .then((session) => {
          req.iamSession = session;
          if (!hasScope(session.scopes, scope)) {
            deps.logger.warn(
              { event: 'AUTHZ_DENIED', vendorId: session.vendorId, scope, sessionId: session.sessionId },
              'scope denied',
            );
            res.status(403).json({ error: 'forbidden', requiredScope: scope, correlationId: req.correlationId });
            return;
          }
          next();
        })
        .catch((err: unknown) => mapError(err, req, res, next));
    };
  }

  // Authn-only middleware (no specific scope) for step-up / logout / whoami.
  function authOnly(req: Request, res: Response, next: NextFunction): void {
    const token = bearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'unauthenticated', correlationId: req.correlationId });
      return;
    }
    authenticate(deps, token)
      .then((session) => {
        req.iamSession = session;
        next();
      })
      .catch((err: unknown) => mapError(err, req, res, next));
  }

  // --- Registration & authentication ---

  router.post(
    '/vendors',
    asyncHandler(deps, async (req, res) => {
      const input = vendorRegistrationSchema.parse(req.body);
      const identity = await registerVendorIdentity(deps, input);
      res.status(201).json({
        vendorId: identity.vendorId,
        businessName: identity.businessName,
        email: identity.email,
        phone: identity.phone,
        createdAt: identity.createdAt,
      });
    }),
  );

  router.post(
    '/auth/otp/request',
    asyncHandler(deps, async (req, res) => {
      const input = requestOtpSchema.parse(req.body);
      const result = await requestOtp(deps, input, { exposeCode: opts.exposeDevCode });
      res.json(result);
    }),
  );

  router.post(
    '/auth/otp/verify',
    asyncHandler(deps, async (req, res) => {
      const input = verifyOtpSchema.parse(req.body);
      const { token, session } = await verifyOtpAndLogin(deps, input);
      const maxAge = session.absoluteExpiresAt.getTime() - Date.now();
      setSessionCookie(res, token, maxAge, opts.secureCookies);
      res.json({ token, session });
    }),
  );

  router.post(
    '/auth/mfa/step-up',
    authOnly,
    asyncHandler(deps, async (req, res) => {
      const input = stepUpMfaSchema.parse(req.body);
      const session = await stepUpMfa(deps, req.iamSession!, input.idToken);
      res.json({ session });
    }),
  );

  router.get(
    '/auth/session',
    authOnly,
    asyncHandler(deps, async (req, res) => {
      res.json({ session: toSessionView(req.iamSession!) });
    }),
  );

  router.post(
    '/auth/logout',
    authOnly,
    asyncHandler(deps, async (req, res) => {
      await logout(deps, req.iamSession!);
      setSessionCookie(res, '', 0, opts.secureCookies);
      res.status(204).end();
    }),
  );

  // --- Demo of the CLICK gate: requires an elevated, MFA-backed scope ---
  router.get('/click/ping', requireScope(SCOPES.CLICK_ACCESS), (req: Request, res: Response) => {
    res.json({ ok: true, vendorId: req.iamSession?.vendorId });
  });

  return router;
}
