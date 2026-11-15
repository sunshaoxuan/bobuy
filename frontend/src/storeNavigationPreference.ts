export type NavigationDevice = 'mobile' | 'desktop';
export const navigationStorageKey = (device: NavigationDevice) => `bobbuy_store_navigation_${device}`;
export function navigationDevice(width: number): NavigationDevice { return width <= 767 ? 'mobile' : 'desktop'; }
export function readNavigationExpanded(device: NavigationDevice, storage: Pick<Storage, 'getItem'> = localStorage): boolean {
  try { return storage.getItem(navigationStorageKey(device)) === 'expanded'; } catch { return false; }
}
export function rememberNavigationExpanded(device: NavigationDevice, expanded: boolean, storage: Pick<Storage, 'setItem'> = localStorage): void {
  try { storage.setItem(navigationStorageKey(device), expanded ? 'expanded' : 'collapsed'); } catch { /* Storage is optional. */ }
}
