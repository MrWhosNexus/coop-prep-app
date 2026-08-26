// @ts-check
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @type {(phase: string) => import('next').NextConfig} */
export default function nextConfig(phase) {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;
  return {
    output: "export",
    images: { unoptimized: true },
    trailingSlash: true,
    // Next always emits root-absolute "/_next/..." asset URLs. That 404s the
    // instant `out/index.html` is opened via file:// (there's no server to
    // root "/" at the export folder), or via a plain double-click. Setting a
    // *relative* assetPrefix makes those into "./_next/...", which resolves
    // against the HTML file's own location instead. This is a known
    // community workaround for exactly this Electron/file:// case, not an
    // officially documented flag -- if a Next upgrade ever breaks it, check
    // node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/assetPrefix.md
    // for what changed, and fall back to serving `out/` over a local
    // 127.0.0.1 HTTP server from main.js instead of file:// if it does.
    assetPrefix: isDev ? undefined : "./",
  };
}
