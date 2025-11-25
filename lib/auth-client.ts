'use client';

export interface User {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  organizationId: string;
  roles: string[];
  permissions?: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: User;
}

const TOKEN_KEY = 'spendrule_access_token';
const REFRESH_TOKEN_KEY = 'spendrule_refresh_token';
const USER_KEY = 'spendrule_user';

export function getStoredTokens(): AuthTokens | null {
  if (typeof window === 'undefined') return null;

  const accessToken = localStorage.getItem(TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  const userStr = localStorage.getItem(USER_KEY);

  if (!accessToken || !refreshToken || !userStr) {
    return null;
  }

  try {
    return {
      accessToken,
      refreshToken,
      user: JSON.parse(userStr),
    };
  } catch {
    return null;
  }
}

export function setStoredTokens(tokens: AuthTokens): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem(TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(tokens.user));
}

export function clearStoredTokens(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const tokens = getStoredTokens();

  if (!tokens) {
    throw new Error('Not authenticated');
  }

  // Safely create headers
  const headers = new Headers();
  
  // Copy existing headers if they exist
  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        headers.set(key, value);
      });
    } else if (Array.isArray(options.headers)) {
      options.headers.forEach(([key, value]) => {
        headers.set(key, value);
      });
    } else if (typeof options.headers === 'object') {
      Object.entries(options.headers).forEach(([key, value]) => {
        if (typeof value === 'string') {
          headers.set(key, value);
        }
      });
    }
  }
  
  headers.set('Authorization', `Bearer ${tokens.accessToken}`);
  
  // Only set Content-Type if it's not FormData (browser will set it automatically with boundary)
  if (!(options.body instanceof FormData)) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }

  let response = await fetch(url, {
    ...options,
    headers,
  });

  // If token expired, try to refresh
  if (response.status === 401) {
    try {
      const refreshed = await refreshAccessToken();
      if (refreshed && refreshed.accessToken) {
        headers.set('Authorization', `Bearer ${refreshed.accessToken}`);
        response = await fetch(url, {
          ...options,
          headers,
        });
      }
    } catch (refreshError) {
      console.error('Error refreshing token:', refreshError);
      // Return the original 401 response if refresh fails
    }
  }

  return response;
}

async function refreshAccessToken(): Promise<AuthTokens | null> {
  const tokens = getStoredTokens();
  if (!tokens) return null;

  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });

    if (!response.ok) {
      clearStoredTokens();
      return null;
    }

    const data = await response.json();
    
    // Validate response data
    if (!data || typeof data !== 'object') {
      clearStoredTokens();
      return null;
    }

    if (!data.accessToken || !data.refreshToken) {
      clearStoredTokens();
      return null;
    }

    const newTokens: AuthTokens = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: (data.user && typeof data.user === 'object') ? data.user : tokens.user, // Use updated user data if provided, otherwise keep existing
    };

    setStoredTokens(newTokens);
    return newTokens;
  } catch (error) {
    console.error('Error refreshing token:', error);
    clearStoredTokens();
    return null;
  }
}
