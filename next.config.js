/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize pdf-parse and its dependencies for server-side
      config.externals = config.externals || [];
      config.externals.push('pdf-parse', 'canvas');
    } else {
      // Client-side: Fix for react-pdf/pdfjs-dist
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      };
      
      // Ignore canvas and other node modules that shouldn't be bundled for client
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig

