/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfkit reads .afm font metrics from disk; keep it external and include data files
  // so standalone/NFT deploys don't 500 on Helvetica.afm.
  // NOTE: production builds use `next build --webpack` (see package.json). Turbopack +
  // pnpm + serverExternalPackages can emit hashed symlinks under .next/node_modules
  // that Vercel rejects as an invalid Serverless Function package.
  serverExternalPackages: ['pdfkit', 'exceljs'],
  outputFileTracingIncludes: {
    '/api/transactions/statement': [
      './assets/fonts/**/*',
      './vendor/pdfkit-data/**/*',
      './node_modules/pdfkit/js/data/**/*',
      './node_modules/.pnpm/pdfkit@*/node_modules/pdfkit/js/data/**/*',
    ],
    '/api/external/v1/[...path]': [
      './assets/fonts/**/*',
      './vendor/pdfkit-data/**/*',
      './node_modules/pdfkit/js/data/**/*',
      './node_modules/.pnpm/pdfkit@*/node_modules/pdfkit/js/data/**/*',
    ],
  },
  experimental: {
    optimizePackageImports: ['framer-motion'],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'utfs.io',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.utfs.io',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'uploadthing.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.uploadthing.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'ufs.sh',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.ufs.sh',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'sandbox.vtpass.com',
        pathname: '/resources/**',
      },
      {
        protocol: 'https',
        hostname: 'www.vtpass.com',
        pathname: '/resources/**',
      },
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'logo.clearbit.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'icons.duckduckgo.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.google.com',
        pathname: '/s2/favicons/**',
      },
      {
        protocol: 'https',
        hostname: 'sogo.africa',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.sogo.africa',
        pathname: '/**',
      },
    ],
  },
}

export default nextConfig
