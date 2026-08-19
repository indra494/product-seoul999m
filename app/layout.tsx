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
  return {title:"언더드릴: 거점전",description:"흙을 파고 다시 매립하며 숨은 장비와 지뢰로 싸우는 2인 분대 도트 전략 게임",icons:{icon:"/favicon.svg",shortcut:"/favicon.svg"},openGraph:{title:"언더드릴: 거점전",description:"땅굴을 직접 만드는 2인 분대 도트 전략 게임"},twitter:{card:"summary",title:"언더드릴: 거점전",description:"땅굴을 직접 만드는 2인 분대 도트 전략 게임"}};
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
