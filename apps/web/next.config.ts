import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Workspace packages use raw TypeScript source (main: ./src/index.ts).
  // transpilePackages tells Next.js to process them through its bundler.
  transpilePackages: ['@adding/types', '@adding/utils'],
  experimental: {
    typedRoutes: true,
  },
}

export default nextConfig
