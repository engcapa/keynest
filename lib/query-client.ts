import { QueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';

const SERVER_PORT = 3000;

export function getApiUrl(): string {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      return `${window.location.protocol}//${window.location.hostname}:${SERVER_PORT}`;
    }
    return `http://localhost:${SERVER_PORT}`;
  }
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return `http://localhost:${SERVER_PORT}`;
}

async function defaultFetcher(url: string) {
  const response = await fetch(url);
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
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
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
