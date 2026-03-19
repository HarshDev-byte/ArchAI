import axios from "axios";

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  timeout: 120_000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach auth token if present (set after Supabase login)
apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("sb-access-token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Surface backend error messages
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    const message =
      error.response?.data?.detail ?? error.message ?? "Unknown error";
    return Promise.reject(new Error(message));
  }
);
