import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API_URL = `${BACKEND_URL}/api`;

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor para agregar el token a todas las peticiones
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores globales (ej. 401 Unauthorized)
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      // Manejar cierre de sesión automático si el token expira
      console.warn("Sesión expirada o no autorizada. Redirigiendo a login...");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      // Opcionalmente recargar o redirigir
      // window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default apiClient;
