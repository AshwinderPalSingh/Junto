import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { APP } from "@/config/app";
import { themeBootScript } from "@/views/theme-script";
import { Providers } from "@/views/providers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: `${APP.name} — ${APP.tagline}`, template: `%s · ${APP.name}` },
  description:
    "Find a verified campus companion for chai, walks, games and errands — right now. Activity first, no swiping, no pressure.",
  applicationName: APP.name,
  appleWebApp: { capable: true, title: APP.name, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: { apple: "/icons/apple-touch-icon.png" },
  openGraph: { title: APP.name, description: `${APP.tagline}. Find someone to do it with.`, type: "website" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfb" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <head>
        {/* Applies the saved light/dark choice before first paint. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-full">
        {/* Drifting light behind the glass surfaces. */}
        <div className="ambient" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
