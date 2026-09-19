export const API_BASE_URL = 'http://localhost:5007';

export async function apiFetch(endpoint, options = {}) {
  const token = options.token;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  if (options.body && !(options.body instanceof FormData)) {
    config.body = JSON.stringify(options.body);
  } else if (options.body instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json().catch(() => null);
    
    if (!response.ok) {
      const error = new Error(data?.message || `HTTP ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    
    return data;
  } catch (error) {
    if (!error.status) {
      error.message = error.message || 'Network error. Please check your connection.';
    }
    throw error;
  }
}

export async function apiGet(endpoint, token) {
  return apiFetch(endpoint, { method: 'GET', token });
}

export async function apiPost(endpoint, body, token) {
  return apiFetch(endpoint, { method: 'POST', body, token });
}

export async function apiPut(endpoint, body, token) {
  return apiFetch(endpoint, { method: 'PUT', body, token });
}

export async function apiDelete(endpoint, token) {
  return apiFetch(endpoint, { method: 'DELETE', token });
}

export async function apiUpload(endpoint, formData, token) {
  return apiFetch(endpoint, { method: 'POST', body: formData, token });
}