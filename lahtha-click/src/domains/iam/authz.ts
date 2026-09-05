// Session-based authorization — the secure bridge between the identity/session
// layer and RBAC. The acting principal is derived from the authenticated session
// token (session.userId), never from a client-supplied header. This closes the
// IAM loop: authn (session) + authz (RBAC permission) in one place.

import type { NextFunction, Request, Response } from 'express';
import { authenticate, SessionInvalidError, toSessionView, type IamDeps } from './use-cases.js';
import { bearerToken } from './http-token.js';
import type { PermissionId } from './rbac/rbac-policy.js';
import { UserNotFoundError, type RbacService } from './rbac/rbac.service.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** RBAC principal resolved from the authenticated session. */
    principalUserId?: string;
  }
}

export interface Authz {
  /** Authenticate the session (401 if missing/invalid); attach it to the request. */
  requireSession: (req: Request, res: Response, next: NextFunction) => void;
  /** Require a session that carries the given RBAC permission (audited). */
  requirePermission: (permission: PermissionId) => (req: Request, res: Response, next: NextFunction) => void;
  /**
   * Best-effort: if a valid session is present, attach its principal; otherwise
   * continue unauthenticated. Lets downstream RBAC routes prefer the session
   * principal over a header without forcing auth at this layer.
   */
  attachPrincipal: (req: Request, res: Response, next: NextFunction) => void;
  /** GET /me — current session + the principal's roles and effective permissions. */
  me: (req: Request, res: Response, next: NextFunction) => void;
}

export function createAuthz(iam: IamDeps, rbac: RbacService): Authz {
  async function resolve(req: Request): Promise<void> {
    // An upstream middleware (attachOidcPrincipal) may have already resolved
    // an SSO principal for this request — session resolution is then a no-op.
    if (req.principalUserId) return;
    const token = bearerToken(req);
    if (!token) throw new SessionInvalidError('not_found');
    const session = await authenticate(iam, token);
    req.iamSession = session;
    req.principalUserId = session.userId;
    req.principalAuthMethod = 'session';
  }

  function requireSession(req: Request, res: Response, next: NextFunction): void {
    resolve(req)
      .then(() => next())
      .catch((err: unknown) => deny401(err, req, res, next));
  }

  function requirePermission(permission: PermissionId) {
    return (req: Request, res: Response, next: NextFunction): void => {
      resolve(req)
        .then(() =>
          rbac.checkPermission({
            actorUserId: req.principalUserId!,
            permission,
            correlationId: req.correlationId,
            sourceIp: req.ip ?? null,
            userAgent: req.header('user-agent') ?? null,
            resourceRef: `${req.method} ${req.path}`,
          }),
        )
        .then((result) => {
          if (result.allowed) {
            next();
            return;
          }
          res.status(403).json({
            error: 'forbidden',
            requiredPermission: permission,
            reason: result.reason,
            correlationId: req.correlationId,
          });
        })
        .catch((err: unknown) => deny401(err, req, res, next));
    };
  }

  function attachPrincipal(req: Request, _res: Response, next: NextFunction): void {
    resolve(req)
      .then(() => next())
      .catch(() => next()); // unauthenticated requests pass through with no principal
  }

  function me(req: Request, res: Response, next: NextFunction): void {
    resolve(req)
      .then(() => rbac.getUserView(req.principalUserId!))
      .then((view) => {
        res.json({
          // Only a session-authenticated request carries an IAM session to
          // describe; an SSO (OIDC) principal has none.
          session: req.iamSession ? toSessionView(req.iamSession) : null,
          authMethod: req.principalAuthMethod ?? 'session',
          principal: {
            userId: view.user.userId,
            personId: view.user.personId,
            principalType: view.user.principalType,
            status: view.user.status,
            roles: view.roles,
            permissions: view.permissions,
          },
        });
      })
      .catch((err: unknown) => {
        if (err instanceof UserNotFoundError) {
          res.status(404).json({ error: 'principal_not_found', correlationId: req.correlationId });
          return;
        }
        deny401(err, req, res, next);
      });
  }

  return { requireSession, requirePermission, attachPrincipal, me };
}

function deny401(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof SessionInvalidError) {
    const code = err.reason === 'not_found' ? 'unauthenticated' : 'session_invalid';
    res.status(401).json({ error: code, reason: err.reason, correlationId: req.correlationId });
    return;
  }
  next(err);
}
