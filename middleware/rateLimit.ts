import { RateLimiter } from 'limiter';
import { NextRequest, NextResponse } from 'next/server';

// Store limiters in memory (note: this will reset when the server restarts)
const ipLimiters: Map<string, RateLimiter> = new Map();

// Configure rate limits
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute window
const RATE_LIMIT_MAX = 10; // 10 requests per minute

export async function rateLimiter(req: NextRequest) {
  // Get client IP
  const ip = req.ip || 'unknown';
  
  // Get or create limiter for this IP
  if (!ipLimiters.has(ip)) {
    ipLimiters.set(
      ip,
      new RateLimiter({
        tokensPerInterval: RATE_LIMIT_MAX,
        interval: RATE_LIMIT_WINDOW,
      })
    );
  }
  
  const limiter = ipLimiters.get(ip)!;
  
  // Check if rate limit is exceeded
  const remainingRequests = await limiter.removeTokens(1);
  
  // If no tokens remaining, rate limit is exceeded
  if (remainingRequests < 0) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429 }
    );
  }
  
  // Add rate limit headers to response
  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', RATE_LIMIT_MAX.toString());
  response.headers.set('X-RateLimit-Remaining', Math.max(0, remainingRequests).toString());
  response.headers.set('X-RateLimit-Reset', (Date.now() + RATE_LIMIT_WINDOW).toString());
  
  return response;
}
