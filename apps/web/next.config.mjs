/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The workspace packages ship TypeScript source rather than a build step, so
  // Next compiles them as part of the app. One less build to keep in sync.
  transpilePackages: ["@layoutcraft/core", "@layoutcraft/render3d", "@layoutcraft/db"],
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // three.js and drei are large; this keeps the editor chunk from pulling in
    // the whole library barrel on the marketing pages.
    optimizePackageImports: ["lucide-react", "@react-three/drei"],
  },
  webpack(config) {
    // The workspace packages are ESM TypeScript, so they import siblings with
    // an explicit ".js" extension as the spec requires. TypeScript maps those
    // back to ".ts" itself; webpack needs telling.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    config.module.rules.push({
      test: /\.(glsl|vs|fs|vert|frag)$/,
      type: "asset/source",
    });
    return config;
  },
};

export default nextConfig;
