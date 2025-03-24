import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// In-memory store for rate limiting
// In a production environment, you would use Redis or another distributed store
interface RateLimitStore {
  [ip: string]: {
    count: number;
    resetTime: number;
  };
}

const apiRateLimits: RateLimitStore = {};

// Rate limit configuration
const RATE_LIMIT_MAX = 10; // Maximum requests per window
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window

export function middleware(request: NextRequest) {
  // Only apply rate limiting to API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const ip = request.ip || 'anonymous';
    const now = Date.now();
    
    // Initialize or reset expired entries
    if (!apiRateLimits[ip] || apiRateLimits[ip].resetTime < now) {
      apiRateLimits[ip] = {
        count: 0,
        resetTime: now + RATE_LIMIT_WINDOW_MS,
      };
    }
    
    // Increment the request count
    apiRateLimits[ip].count++;
    
    // Check if the rate limit has been exceeded
    if (apiRateLimits[ip].count > RATE_LIMIT_MAX) {
      // Return rate limit exceeded response
      return new NextResponse(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'Too many requests, please try again later.',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': RATE_LIMIT_MAX.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil(apiRateLimits[ip].resetTime / 1000).toString(),
            'Retry-After': Math.ceil((apiRateLimits[ip].resetTime - now) / 1000).toString(),
          },
        }
      );
    }
    
    // Add rate limit headers to the response
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', RATE_LIMIT_MAX.toString());
    response.headers.set(
      'X-RateLimit-Remaining', 
      Math.max(0, RATE_LIMIT_MAX - apiRateLimits[ip].count).toString()
    );
    response.headers.set(
      'X-RateLimit-Reset', 
      Math.ceil(apiRateLimits[ip].resetTime / 1000).toString()
    );
    
    return response;
  }
  
  // For non-API routes, just proceed normally
  return NextResponse.next();
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    '/api/:path*',
  ],
};
