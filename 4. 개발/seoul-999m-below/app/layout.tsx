import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { BROWSER_EXTENSION_ERROR_GUARD_SCRIPT } from "../game/browserExtensionErrorGuard";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#090b0d",
};

export async function generateMetadata():Promise<Metadata>{
  await headers();
  const title="서울 지하 999M";
  const description="오염된 서울 지하 999m에서 땅굴을 만들고 자동 굴착대를 지휘해 생존 코어를 차지하는 도트 액션 전략 게임";
  return {
    title,
    description,
    icons: {
      icon: [
        { url: "/favicon.ico?v=3", type: "image/x-icon", sizes: "32x32" },
        { url: "/favicon.svg?v=3", type: "image/svg+xml" },
        { url: "/favicon-32x32.png?v=3", type: "image/png", sizes: "32x32" },
      ],
      shortcut: "/favicon.ico?v=3",
      apple: { url: "/apple-touch-icon.png?v=3", type: "image/png", sizes: "180x180" },
    },
    openGraph:{title,description,images:["/assets/branding/seoul-999m-logo-concept-v1.png"]},
    twitter:{card:"summary_large_image",title,description,images:["/assets/branding/seoul-999m-logo-concept-v1.png"]},
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="icon" href="/favicon.ico?v=3" type="image/x-icon" sizes="32x32" />
        <link rel="icon" href="/favicon.svg?v=3" type="image/svg+xml" />
        <link rel="icon" href="/favicon-32x32.png?v=3" type="image/png" sizes="32x32" />
        <link rel="shortcut icon" href="/favicon.ico?v=3" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=3" sizes="180x180" />
        <script
          dangerouslySetInnerHTML={{
            __html: BROWSER_EXTENSION_ERROR_GUARD_SCRIPT,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
