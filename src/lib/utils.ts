import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Bearer header for the backend's admin-only endpoints (requireGymAdmin /
// requireGymSuperAdmin). Empty when logged out, so the server answers 401 instead of the
// request silently going through.
export function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Thrown for 401/403 so callers can tell it apart from a network failure: several pages
// retry the bare path when the /api one throws, which would otherwise swallow the real
// reason and show a JSON parse error instead.
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

// Call right after fetch() on an admin-only endpoint. 401 means the session is gone:
// drop the token and go to the login page rather than leave every button failing.
export function assertAuthorized(resp: Response): void {
  if (resp.status === 401) {
    localStorage.removeItem('auth_token');
    window.location.assign('/login');
    throw new AuthError('Sesi login berakhir, silakan login ulang.');
  }
  if (resp.status === 403) {
    throw new AuthError('Akun Anda tidak punya akses untuk tindakan ini.');
  }
}
