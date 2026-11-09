import { readFileSync } from 'node:fs';

// The Spring Boot API has no CORS configuration, so the browser must call it on this origin: Next proxies /api and
// /actuator to it (README §3.1). In production put the app and the API behind one reverse proxy instead.
const apiOrigin = process.env.API_PROXY_TARGET ?? 'http://localhost:8080';

// The app version from package.json, shown in the sign-in footer.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_APP_VERSION: version },
  poweredByHeader: false,
  async rewrites() {
    return [
      { source: '/api/v1/:path*', destination: `${apiOrigin}/api/v1/:path*` },
      { source: '/actuator/:path*', destination: `${apiOrigin}/actuator/:path*` },
    ];
  },
  async headers() {
    // The refresh token is readable by JS (the backend has no cookie session): keep framing and referrers locked down.
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  images: { unoptimized: true },
};

export default nextConfig;
