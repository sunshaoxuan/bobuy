// URL is the browsing context, never an authorization or merchant impersonation.
export function selectedNode(search: string): number | undefined {
  const raw = new URLSearchParams(search).get('node');
  if (raw === null) return undefined;
  const id = Number(raw);
  return /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(id) ? id : -1;
}
export function scopedPath(path: string, search: string): string {
  const node = new URLSearchParams(search).get('node');
  return path + (node === null ? '' : '?'+new URLSearchParams({node}));
}
