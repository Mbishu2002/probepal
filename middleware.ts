import { NextRequest, NextResponse } from 'next/server';
import { rateLimiter } from './middleware/rateLimit';

export async function middleware(request: NextRequest) {
  // Only apply to API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // In production, check for authentication for certain sensitive endpoints
    // But allow client-side accessible endpoints to work without authentication
    if (process.env.NODE_ENV === 'production') {
      // Get the authorization header
      const authHeader = request.headers.get('authorization');
      const apiKey = process.env.API_SECRET_KEY;
      
      // If no API key is set in environment, block all API access in production
      if (!apiKey) {
        return NextResponse.json(
          { error: 'API access is disabled in production' },
          { status: 403 }
        );
      }
      
      // Allow certain endpoints that need to be accessible from the client
      // These are endpoints that don't expose sensitive data or operations
      const publicEndpoints = [
        '/api/system-prompt',
        '/api/generate'
      ];
      
      const isPublicEndpoint = publicEndpoints.some(endpoint => 
        request.nextUrl.pathname.startsWith(endpoint)
      );
      
      // Skip auth check for public endpoints
      if (!isPublicEndpoint) {
        // Check if the authorization header is valid for non-public endpoints
        if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.substring(7) !== apiKey) {
          return NextResponse.json(
            { error: 'Unauthorized access' },
            { status: 401 }
          );
        }
      }
    }
    
    // Apply rate limiting
    return rateLimiter(request);
  }
  
  // For non-API routes, continue without restrictions
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Apply to all API routes
    '/api/:path*',
  ],
};
