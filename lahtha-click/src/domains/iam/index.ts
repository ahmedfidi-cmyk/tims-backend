// Public entry point for the IAM (identity + session + RBAC) domain.
// The composition root lives in module.ts (createIamModule).

export { createIamModule } from './module.js';
export { createIamRouter } from './iam.routes.js';
export { createAuthz } from './authz.js';
export * from './use-cases.js';
export * from './scopes.js';
export type * from './types.js';
