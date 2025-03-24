import axios from 'axios';

// Create an axios instance with default configuration
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
});

// Add a request interceptor to handle authentication if needed
api.interceptors.request.use(
  (config) => {
    // You can add authentication headers here if needed
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle rate limiting errors
    if (error.response && error.response.status === 429) {
      console.error('Rate limit exceeded. Please try again later.');
      // You could add a user-friendly notification here
    }
    
    // Handle other API errors
    console.error('API Error:', error.response?.data?.error || error.message);
    
    return Promise.reject(error);
  }
);

export default api;
