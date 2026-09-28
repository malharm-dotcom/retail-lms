/** @type {import('next').NextConfig} */
const nextConfig = {
  // PDF uploads go through /api/files, which sits behind the auth proxy (default cap 10 MB).
  experimental: { proxyClientMaxBodySize: "26mb" },
};

export default nextConfig;
