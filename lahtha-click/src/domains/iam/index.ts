// Public entry point for the IAM (identity + session + RBAC) domain.
// The composition root lives in module.ts (createIamModule).

export { createIamModule, createRbacService, createOidcAuthzMiddleware } from './module.js';
export { createIamRouter } from './iam.routes.js';
export { createAuthz } from './authz.js';
export { attachOidcPrincipal } from './oidc-authz.js';
export { GenericOidcVerifier, OidcVerificationError } from './oidc-verifier.js';
export type { OidcClaims, OidcTokenVerifierPort, OidcVerifierConfig } from './oidc-verifier.js';
export * from './use-cases.js';
export * from './scopes.js';
export type * from './types.js';
