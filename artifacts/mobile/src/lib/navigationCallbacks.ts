/**
 * navigationCallbacks.ts
 *
 * Module-level callback registry for passing data from child screens back to
 * parent screens without serializing functions through navigation params.
 *
 * Usage:
 *   Parent:
 *     const key = registerNavCallback(item => setItems(p => [item, ...p]));
 *     navigation.navigate('AddEntry', { callbackKey: key, ... });
 *
 *   Child (on success):
 *     invokeNavCallback(route.params.callbackKey, newItem);
 *     navigation.goBack();
 */

const registry = new Map<string, (...args: any[]) => void>();
let counter = 0;

/** Register a callback and return a unique key to pass via navigation params. */
export function registerNavCallback(cb: (...args: any[]) => void): string {
  const key = `nav_cb_${++counter}`;
  registry.set(key, cb);
  return key;
}

/** Invoke the callback (if registered) and immediately remove it. */
export function invokeNavCallback(key: string | undefined, ...args: any[]): void {
  if (!key) return;
  registry.get(key)?.(...args);
  registry.delete(key);
}

/** Manually clear a callback (e.g. on unmount). */
export function clearNavCallback(key: string | undefined): void {
  if (key) registry.delete(key);
}
