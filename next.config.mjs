/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  transpilePackages: [
    '@capacitor/core',
    '@capacitor/app',
    '@capacitor/share',
    '@capacitor/camera',
    '@capacitor/network',
    '@capacitor/status-bar',
    '@capacitor/splash-screen',
    '@capacitor/haptics',
    '@capacitor/push-notifications',
  ],
  // Permanent redirects for consolidated staff portal
  async redirects() {
    return [
      {
        source: '/admin/login',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/admin/login/:path*',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/staff/login',
        destination: '/admin',
        permanent: true,
      },
    ];
  },
  // Ensure headers for PWA & security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
