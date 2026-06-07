// Model-code allowlist — pure. A device cannot be registered with an unknown
// model code (imei-inventory-schema.md §validation rule 2). Phase-1 seed list of
// current Apple model codes; extend as the catalog grows.

export interface ModelEntry {
  modelCode: string;
  modelName: string;
}

// Seed catalog (subset; representative of LAHTHA's primary-market focus).
export const MODEL_CATALOG: Record<string, string> = {
  A3105: 'iPhone 17 Pro',
  A3106: 'iPhone 17 Pro Max',
  A3104: 'iPhone 17',
  A3290: 'iPhone 16 Pro',
  A3291: 'iPhone 16 Pro Max',
  A3287: 'iPhone 16',
  A2849: 'iPhone 15 Pro',
  A2850: 'iPhone 15 Pro Max',
  A3102: 'iPhone 15',
};

export function isKnownModel(modelCode: string): boolean {
  return Object.prototype.hasOwnProperty.call(MODEL_CATALOG, modelCode);
}

/** Resolve a model code to its display name, or null if unknown. */
export function modelNameFor(modelCode: string): string | null {
  return MODEL_CATALOG[modelCode] ?? null;
}

export function listModels(): ModelEntry[] {
  return Object.entries(MODEL_CATALOG).map(([modelCode, modelName]) => ({ modelCode, modelName }));
}
