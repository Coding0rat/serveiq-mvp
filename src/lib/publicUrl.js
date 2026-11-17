const configuredAppUrl = (import.meta.env.VITE_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');

export function getPublicAppUrl() {
  if (configuredAppUrl) return configuredAppUrl;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

export function getTableUrl(tableId) {
  return `${getPublicAppUrl()}/t/${encodeURIComponent(tableId)}`;
}
