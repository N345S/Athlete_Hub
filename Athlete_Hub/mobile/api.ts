import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Where the app reads the database from. The app never talks to MySQL itself: every read goes through the
 * ASP.NET API, which checks the sign-in token and the user's role first.
 *
 * 1. EXPO_PUBLIC_API_BASE_URL (in mobile/.env.local), e.g. the hosted Railway address. Works on any phone.
 * 2. On a phone running Expo Go: the computer that serves the app, through the web app's phone proxy
 *    (`npm run dev:phone` in web/, port 5173), so the API itself can stay on localhost.
 * 3. Emulators and simulators: the API on this computer (Android reaches it as 10.0.2.2).
 */
function resolveApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');

  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (devHost && !['localhost', '127.0.0.1', '10.0.2.2'].includes(devHost) && Platform.OS !== 'web') {
    return `http://${devHost}:5173`;
  }

  return Platform.OS === 'android' ? 'http://10.0.2.2:5007' : 'http://localhost:5007';
}

export const API_BASE_URL = resolveApiBaseUrl();

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Called when the API rejects the stored token, so the app can send the user back to sign in.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

/** Sends a request to the API and returns the parsed body, or throws an ApiError with a plain message. */
export async function apiRequest<T = any>(
  endpoint: string,
  { method = 'GET', body, token }: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('We cannot connect right now. Check your internet connection and try again.', 0);
  }

  if (response.status === 401 && token) onUnauthorized?.();

  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(data?.message || friendlyStatus(response.status), response.status);
  return data as T;
}

// Used when the server sends no message of its own. Written for anyone: no codes or technical words.
function friendlyStatus(status: number): string {
  if (status === 400) return 'Some of the information is missing or not right. Please check and try again.';
  if (status === 401) return 'You have been signed out. Please sign in again.';
  if (status === 403) return 'You are not allowed to do this.';
  if (status === 404) return 'We could not find what you were looking for. It may have been deleted.';
  if (status === 429) return 'You tried too many times. Please wait a minute and try again.';
  if (status >= 500) return 'Something went wrong on our side. Please try again in a moment.';
  return 'Something went wrong. Please try again.';
}

/** Loads an endpoint when the screen opens (and whenever it changes). Pass null to skip loading. */
export function useApiData<T = any>(endpoint: string | null, token: string, initialData: T | null = null) {
  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState(Boolean(endpoint));
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!endpoint) return;
    setLoading(true);
    try {
      setData(await apiRequest<T>(endpoint, { token }));
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [endpoint, token]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload };
}

/** Today's date on this phone as yyyy-MM-dd, matching how the API sends dates. */
export function localDateISO(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "Mon, Oct 27" from a yyyy-MM-dd date (read as a local date, not UTC). */
export function formatDate(value?: string | null): string {
  if (!value) return '';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "4:00 PM" from "16:00:00"; empty when there is no time. */
export function formatTime(value?: string | null): string {
  if (!value) return '';
  const [hours, minutes] = value.split(':').map(Number);
  if (Number.isNaN(hours)) return '';
  const suffix = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 || 12}:${String(minutes || 0).padStart(2, '0')} ${suffix}`;
}

export function formatTimeRange(start?: string | null, end?: string | null): string {
  const from = formatTime(start);
  const to = formatTime(end);
  if (!from) return 'Time TBA';
  return to ? `${from} – ${to}` : from;
}
