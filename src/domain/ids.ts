type RandomUuidSource = {
  randomUUID?: () => string;
};

export function createId(source: RandomUuidSource | null | undefined = globalThis.crypto): string {
  if (typeof source?.randomUUID === "function") {
    try {
      return source.randomUUID();
    } catch {
      // Fall through for insecure origins or browser implementations that reject access.
    }
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
