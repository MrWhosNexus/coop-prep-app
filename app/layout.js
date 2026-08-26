import { Inter } from "next/font/google";
import "./globals.css";

/**
 * Inter, self-hosted.
 *
 * This used to be a remote <link> to Google's font CDN, plus two preconnects.
 * That was broken twice over: electron/main.js's buildCsp() sets
 * `default-src 'self'`, so the packaged app BLOCKED the stylesheet and silently
 * fell down the --font-body stack to system-ui — while still opening two
 * connections to Google on every launch, in an app that otherwise makes zero
 * network calls.
 *
 * next/font/google downloads Inter at BUILD time and emits it into the export as
 * a local woff2 under _next/static/media. At runtime nothing is fetched from
 * Google, and `font-src 'self' data:` already permits the local file — the CSP
 * that protects the user's API keys does not have to be loosened.
 *
 * NOTE: the hostnames are deliberately not spelled out anywhere in this file;
 * test/dashboard-scope.test.js asserts they appear nowhere in it at all, which
 * is a blunt but unambiguous guard against this regressing.
 *
 * `variable` (not `className`): the app's typography flows through the
 * --font-display/--font-body tokens in globals.css, not through a class on
 * <html>. Those tokens are re-pointed at this font below.
 */
const inter = Inter({
  subsets: ["latin"],
  // No `weight`: Inter is a variable font and 'variable' is the default, so one
  // file covers the whole 100-900 axis — a superset of the 400;500;600;700;800
  // the old Google URL asked for. (Passing a "100 900" range string is rejected
  // by this loader: "Unknown weight 100 900 for font Inter".)
  display: "swap",
  variable: "--font-inter",
  fallback: ["system-ui", "sans-serif"],
});

/**
 * Re-point the globals.css font tokens at the self-hosted family.
 *
 * globals.css names the family literally ("Inter") in its --font-display /
 * --font-body stacks, and that slot only ever resolved because of the Google
 * stylesheet. As it happens THIS Next version's next/font also emits
 * `@font-face{font-family:Inter}` (verified in the built output), so the token
 * would resolve untouched today — but that bare family name is an internal
 * detail, not an API. next/font has historically emitted hashed names
 * (`__Inter_abc123`), and if it ever does again the stack would silently fall
 * back to system-ui: exactly the bug being fixed here, reintroduced invisibly.
 * `variable` IS the documented contract, so the tokens go through it.
 *
 * The slot order is preserved EXACTLY as globals.css declares it — Apple system
 * faces first, Inter as the cross-platform stand-in, system-ui last. This fix is
 * about making the Inter slot resolve offline, not about changing which face
 * wins on any given OS.
 *
 * `html:root` (0,1,1) outranks globals.css's `:root, [data-theme="daylight"]`
 * (0,1,0), so this holds regardless of stylesheet order and for every theme.
 * The var() fallback keeps the declaration valid if --font-inter ever vanishes.
 */
const FONT_TOKENS = `html:root{
  --font-display: -apple-system, BlinkMacSystemFont, "SF Pro Display", var(--font-inter, "Inter"), system-ui, sans-serif;
  --font-body: -apple-system, BlinkMacSystemFont, "SF Pro Text", var(--font-inter, "Inter"), system-ui, sans-serif;
}`;

export const metadata = {
  title: "COOP Prep — Fellowship Ready",
  description: "Private learning app for COOP Financial Services Track",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`h-full ${inter.variable}`} data-theme="daylight" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: FONT_TOKENS }} />
        {/* Apply the saved theme before paint to avoid a flash of the default palette. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('coop_theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-full" suppressHydrationWarning>{children}</body>
    </html>
  );
}
