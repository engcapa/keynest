import { QueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';

const SERVER_PORT = 3000;
const TOKEN_STORAGE_KEY = 'mfa_vault_server_token';

export function getApiUrl(): string {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      const { protocol, hostname, port } = window.location;
      if (port && port !== '8081') {
        return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
      }
      return `${protocol}//${hostname}:${SERVER_PORT}`;
    }
    return `http://localhost:${SERVER_PORT}`;
  }
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return `http://localhost:${SERVER_PORT}`;
}

function webStorage(): Storage | null {
  if (Platform.OS !== 'web') return null;
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
  } catch { /* ignore */ }
  return null;
}

export function getAuthToken(): string | null {
  const s = webStorage();
  if (!s) return null;
  try { return s.getItem(TOKEN_STORAGE_KEY); } catch { return null; }
}

export function setAuthToken(token: string | null): void {
  const s = webStorage();
  if (!s) return;
  try {
    if (token) s.setItem(TOKEN_STORAGE_KEY, token);
    else s.removeItem(TOKEN_STORAGE_KEY);
  } catch { /* ignore */ }
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class AuthRequiredError extends Error {
  constructor() {
    super('Authentication required');
    this.name = 'AuthRequiredError';
  }
}

async function defaultFetcher(url: string) {
  const response = await fetch(url, { headers: { ...authHeaders() } });
  if (response.status === 401) {
    setAuthToken(null);
    throw new AuthRequiredError();
  }
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `HTTP error ${response.status}`);
  }
  return response.json();
}

export async function apiRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  path: string,
  body?: unknown
): Promise<unknown> {
  const url = new URL(path, getApiUrl()).toString();
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 401) {
    setAuthToken(null);
    throw new AuthRequiredError();
  }
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `HTTP error ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: ({ queryKey }) => {
        const [url] = queryKey as string[];
        const fullUrl = new URL(url, getApiUrl()).toString();
        return defaultFetcher(fullUrl);
      },
      retry: 1,
      staleTime: 30000,
    },
  },
});
