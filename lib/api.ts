import axios from 'axios';

// Create an axios instance with default configuration for client-side API calls
const api = axios.create({
  baseURL: '/',
  timeout: 30000, // 30 seconds
});

// For client-side usage, we need to create a way to access the API key
// Since we can't expose API_SECRET_KEY directly to the client
// We'll need to create a separate endpoint to handle authentication

// For now, we'll modify the middleware to accept requests without authentication in development
// In production, we'll need to handle this differently

// Add a request interceptor for potential future authentication needs
api.interceptors.request.use(
  (config) => {
    // In the future, we could add authentication logic here if needed
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
