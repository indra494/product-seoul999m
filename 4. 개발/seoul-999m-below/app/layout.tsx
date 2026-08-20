import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata():Promise<Metadata>{
  await headers();
  const title="서울 지하 999M";
  const description="오염된 서울 지하 999m에서 땅굴을 만들고 자동 굴착대를 지휘해 생존 코어를 차지하는 도트 액션 전략 게임";
  return {title,description,icons:{icon:"/favicon.svg",shortcut:"/favicon.svg"},openGraph:{title,description,images:["/assets/branding/seoul-999m-logo-concept-v1.png"]},twitter:{card:"summary_large_image",title,description,images:["/assets/branding/seoul-999m-logo-concept-v1.png"]}};
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
