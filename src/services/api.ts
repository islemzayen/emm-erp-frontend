import axios from "axios";

const api = axios.create({
baseURL: `${process.env.NEXT_PUBLIC_API_URL}/api`,});

// In-memory token store — set by AuthContext after login
let _token: string | null = null;

export const setAuthToken = (token: string | null) => {
  _token = token;
  if (token) sessionStorage.setItem("_t", token);
  else sessionStorage.removeItem("_t");
};

const getStoredToken = (): string | null => {
  // Prefer in-memory, fall back to sessionStorage (survives F5 refresh)
  return _token || sessionStorage.getItem("_t");
};

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;