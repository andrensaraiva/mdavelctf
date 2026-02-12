import { auth } from '../firebase';

// In production, VITE_API_BASE_URL should point to the deployed API (e.g. https://mdavelctf-api.onrender.com)
// In dev, it falls back to '/api' which is proxied by Vite to localhost:4000
const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api`
  : '/api';

async function getHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (user) {
    const token = await user.getIdToken();
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/** Safely parse JSON from response; returns null for empty bodies */
async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text || text.trim().length === 0) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid response from server: ${text.slice(0, 200)}`);
  }
}

export async function apiPost<T = any>(path: string, body: unknown): Promise<T> {
  const url = `${API_BASE}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(body),
    });
  } catch (err: any) {
    throw new Error(`Network error: could not reach API at ${url}. Check VITE_API_BASE_URL and CORS_ORIGINS.`);
  }
  const data = await safeJson(res);
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status} ${res.statusText})`);
  }
  if (data === null) {
    throw new Error(`Empty response from server (${res.status}). Check API logs and CORS_ORIGINS env var.`);
  }
  return data;
}

export async function apiPut<T = any>(path: string, body: unknown): Promise<T> {
  const url = `${API_BASE}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'PUT',
      headers: await getHeaders(),
      body: JSON.stringify(body),
    });
  } catch (err: any) {
    throw new Error(`Network error: could not reach API at ${url}. Check VITE_API_BASE_URL and CORS_ORIGINS.`);
  }
  const data = await safeJson(res);
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status} ${res.statusText})`);
  }
  if (data === null) {
    throw new Error(`Empty response from server (${res.status}). Check API logs and CORS_ORIGINS env var.`);
  }
  return data;
}

export async function apiGet<T = any>(path: string): Promise<T> {
  const url = `${API_BASE}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: await getHeaders(),
    });
  } catch (err: any) {
    throw new Error(`Network error: could not reach API at ${url}. Check VITE_API_BASE_URL and CORS_ORIGINS.`);
  }
  const data = await safeJson(res);
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status} ${res.statusText})`);
  }
  if (data === null) {
    throw new Error(`Empty response from server (${res.status}). Check API logs and CORS_ORIGINS env var.`);
  }
  return data;
}
