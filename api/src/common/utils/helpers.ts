export function toBool(v: string | boolean | undefined, fallback: boolean): boolean {
  if (typeof v === 'string') return ['true', '1', 'yes', 'y'].includes(v.toLowerCase());
  if (typeof v === 'boolean') return v;
  return fallback;
}

export function toInt(v: string | number | undefined, fallback: number): number {
  if (typeof v === 'string') {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : fallback;
  }
  if (typeof v === 'number') return v;
  return fallback;
}

export function normalizeDictionary(raw: string | string[] | undefined): string[] | null {
  if (!raw) return null;
  
  if (Array.isArray(raw)) return raw;
  
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {
      // fall through to comma-separated parsing
    }
    
    const arr = raw.split(',').map(s => s.trim()).filter(Boolean);
    return arr.length ? arr : null;
  }
  
  return null;
}

export function sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
  const clone = { ...headers };
  delete clone['x-api-key'];
  delete clone.authorization;
  return clone;
}

export function isLocalUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return ['localhost', '127.0.0.1'].includes(u.hostname);
  } catch (_) {
    return false;
  }
}

export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return 'Unknown';
  try {
    return new Date(dateStr).toLocaleString();
  } catch (_) {
    return dateStr;
  }
}