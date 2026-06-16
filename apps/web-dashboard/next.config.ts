import type { NextConfig } from 'next';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages compiled on demand.
  transpilePackages: ['@crawlpay/types'],
  // Proxy /api/* to the api-gateway so the browser sees a same-origin request.
  // That's required for the session cookie set by the api-gateway to reach
  // the browser without SameSite=None+Secure dance (which doesn't work on
  // localhost without HTTPS).
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/:path*` }];
  },
};

export default nextConfig;
