// Authorization middleware. Declares the permission a handler requires; every
// check (allow or deny) is recorded in access_audit with the correlation id.
//
// Phase-1 actor resolution uses the `x-user-id` header. Once sessions carry a
// user_id (auth↔user bridge), swap the header read for the session principal.

import type { NextFunction, Request, Response } from 'express';
import type { PermissionId } from './rbac-policy.js';
import type { RbacService } from './rbac.service.js';

export const ACTOR_HEADER = 'x-user-id';

declare module 'express-serve-static-core' {
  interface Request {
    rbacActorUserId?: string;
  }
}

export function requirePermission(service: RbacService, permission: PermissionId) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const actorUserId = req.header(ACTOR_HEADER)?.trim();
    if (!actorUserId) {
      res.status(401).json({ error: 'unauthenticated', correlationId: req.correlationId });
      return;
    }
    service
      .checkPermission({
        actorUserId,
        permission,
        correlationId: req.correlationId,
        sourceIp: req.ip ?? null,
        userAgent: req.header('user-agent') ?? null,
        resourceRef: `${req.method} ${req.path}`,
      })
      .then((result) => {
        if (result.allowed) {
          req.rbacActorUserId = actorUserId;
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
      .catch((err: unknown) => next(err));
  };
}
