// HTTP controllers for RBAC. Thin: validate (zod), call the service, map errors.

import { Router, type NextFunction, type Request, type Response } from 'express';
import { z, ZodError } from 'zod';
import {
  PRINCIPAL_TYPES,
  USER_STATUSES,
  USER_STATUS_ACTIONS,
  listRoleCatalog,
  InvalidUserStatusTransition,
  type PermissionId,
  type PrincipalType,
  type UserStatus,
} from './rbac-policy.js';
import {
  PersonNotFoundError,
  RbacConflictError,
  RbacService,
  RoleNotGrantableError,
  UnknownRoleError,
  UserNotFoundError,
} from './rbac.service.js';
import { requirePermission, ACTOR_HEADER } from './require-permission.js';

const createPersonSchema = z.object({
  fullName: z.string().trim().min(2).max(200),
  primaryPhone: z.string().trim().regex(/^\+?[1-9]\d{7,14}$/, 'must be a valid E.164 phone number'),
  nationalId: z.string().trim().min(4).max(40).optional(),
});

const createUserSchema = z.object({
  principalType: z.enum(PRINCIPAL_TYPES),
});

const grantRoleSchema = z.object({ roleId: z.string().trim().min(1) });

const statusSchema = z.object({
  action: z.enum([
    USER_STATUS_ACTIONS.ACTIVATE,
    USER_STATUS_ACTIONS.SUSPEND,
    USER_STATUS_ACTIONS.REINSTATE,
    USER_STATUS_ACTIONS.REVOKE,
  ]),
});

function param(req: Request, name: string): string {
  return req.params[name] ?? '';
}

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch((err: unknown) => mapError(err, req, res, next));
  };
}

function mapError(err: unknown, req: Request, res: Response, next: NextFunction): void {
  const correlationId = req.correlationId;
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'validation_error', issues: err.issues, correlationId });
    return;
  }
  if (err instanceof PersonNotFoundError) {
    res.status(404).json({ error: 'person_not_found', personId: err.personId, correlationId });
    return;
  }
  if (err instanceof UserNotFoundError) {
    res.status(404).json({ error: 'user_not_found', userId: err.userId, correlationId });
    return;
  }
  if (err instanceof RbacConflictError) {
    res.status(409).json({ error: 'conflict', message: err.message, correlationId });
    return;
  }
  if (err instanceof RoleNotGrantableError) {
    res.status(422).json({ error: 'role_not_grantable', roleId: err.roleId, correlationId });
    return;
  }
  if (err instanceof UnknownRoleError) {
    res.status(400).json({ error: 'unknown_role', roleId: err.roleId, correlationId });
    return;
  }
  if (err instanceof InvalidUserStatusTransition) {
    res.status(409).json({
      error: 'invalid_status_transition',
      from: err.from,
      action: err.action,
      correlationId,
    });
    return;
  }
  next(err);
}

export interface RbacRouterOptions {
  /** Allow `x-user-id` as a fallback actor for permission checks (dev bootstrap). */
  allowHeaderActor?: boolean;
}

export function createRbacRouter(service: RbacService, opts: RbacRouterOptions = {}): Router {
  const router = Router();
  const actorOf = (req: Request): string =>
    req.principalUserId ?? (opts.allowHeaderActor ? req.header(ACTOR_HEADER)?.trim() || 'system' : 'system');

  router.get('/roles', (_req: Request, res: Response) => {
    res.json({ items: listRoleCatalog() });
  });

  router.post(
    '/persons',
    asyncHandler(async (req, res) => {
      const input = createPersonSchema.parse(req.body);
      const person = await service.createPerson(input);
      res.status(201).json({
        personId: person.personId,
        fullName: person.fullName,
        primaryPhone: person.primaryPhone,
        hasNationalId: person.nationalIdHash !== null,
        createdAt: person.createdAt,
      });
    }),
  );

  router.post(
    '/persons/:personId/users',
    asyncHandler(async (req, res) => {
      const { principalType } = createUserSchema.parse(req.body);
      const user = await service.createUser(param(req, 'personId'), principalType);
      res.status(201).json(user);
    }),
  );

  router.get(
    '/users/:userId',
    asyncHandler(async (req, res) => {
      const view = await service.getUserView(param(req, 'userId'));
      res.json(view);
    }),
  );

  router.get(
    '/users/:userId/permissions',
    asyncHandler(async (req, res) => {
      const view = await service.getUserView(param(req, 'userId'));
      res.json({ userId: view.user.userId, status: view.user.status, permissions: view.permissions });
    }),
  );

  // Admin listing of users (with roles) for the role-management table.
  router.get(
    '/admin/users',
    requirePermission(service, 'platform.iam.manage', opts),
    asyncHandler(async (req, res) => {
      const pt = typeof req.query.principalType === 'string' ? req.query.principalType : undefined;
      const st = typeof req.query.status === 'string' ? req.query.status : undefined;
      const items = await service.listUsers({
        ...(pt && (PRINCIPAL_TYPES as readonly string[]).includes(pt) ? { principalType: pt as PrincipalType } : {}),
        ...(st && (USER_STATUSES as readonly string[]).includes(st) ? { status: st as UserStatus } : {}),
        limit: 200,
      });
      res.json({ items, total: items.length });
    }),
  );

  // --- RBAC mutations: gated on the session principal's platform.iam.manage ---

  router.post(
    '/users/:userId/roles',
    requirePermission(service, 'platform.iam.manage', opts),
    asyncHandler(async (req, res) => {
      const { roleId } = grantRoleSchema.parse(req.body);
      await service.grantRole(param(req, 'userId'), roleId, actorOf(req));
      res.status(204).end();
    }),
  );

  router.delete(
    '/users/:userId/roles/:roleId',
    requirePermission(service, 'platform.iam.manage', opts),
    asyncHandler(async (req, res) => {
      await service.revokeRole(param(req, 'userId'), param(req, 'roleId'), actorOf(req));
      res.status(204).end();
    }),
  );

  router.post(
    '/users/:userId/status',
    requirePermission(service, 'platform.iam.manage', opts),
    asyncHandler(async (req, res) => {
      const { action } = statusSchema.parse(req.body);
      const user = await service.setUserStatus(param(req, 'userId'), action);
      res.json(user);
    }),
  );

  // Reading the access audit requires the compliance permission.
  router.get(
    '/access-audit',
    requirePermission(service, 'platform.audit.read', opts),
    asyncHandler(async (req, res) => {
      const actorUserId = typeof req.query.actorUserId === 'string' ? req.query.actorUserId : undefined;
      const actedOnUserId = typeof req.query.actedOnUserId === 'string' ? req.query.actedOnUserId : undefined;
      const entries = await service.listAccessAudit({
        ...(actorUserId ? { actorUserId } : {}),
        ...(actedOnUserId ? { actedOnUserId } : {}),
        limit: 100,
      });
      res.json({ items: entries, total: entries.length });
    }),
  );

  // Demo of requirePermission: needs platform.read_all (admin.support+).
  router.get(
    '/rbac/ping',
    requirePermission(service, 'platform.read_all', opts),
    (req: Request, res: Response) => {
      res.json({ ok: true, actorUserId: req.rbacActorUserId });
    },
  );

  return router;
}

// Re-export so callers can reference permission ids without deep imports.
export type { PermissionId };
