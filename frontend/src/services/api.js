import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api"
});

let isHandlingUnauthorized = false;

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("hrcrm_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url || "";
    const isAuthRoute = requestUrl.includes("/auth/login") || requestUrl.includes("/auth/register");

    if (error.response?.status === 401 && !isAuthRoute && !isHandlingUnauthorized) {
      isHandlingUnauthorized = true;
      localStorage.removeItem("hrcrm_token");
      sessionStorage.setItem("hrcrm_auth_message", "Your session expired. Please sign in again.");
      window.location.href = "/";
    }

    return Promise.reject(error);
  }
);

export default api;
