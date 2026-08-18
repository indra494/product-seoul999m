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
  const h=await headers(),host=h.get("x-forwarded-host")??h.get("host")??"localhost:3000",protocol=h.get("x-forwarded-proto")??(host.startsWith("localhost")?"http":"https"),image=`${protocol}://${host}/og.png`;
  return {title:"안개 분대: 거점전",description:"두 캐릭터를 전환하며 전장의 안개 속에서 적 거점을 파괴하는 도트 액션 전략 게임",icons:{icon:"/favicon.svg",shortcut:"/favicon.svg"},openGraph:{title:"안개 분대: 거점전",description:"2인 분대 도트 액션 전략 게임",images:[image]},twitter:{card:"summary_large_image",title:"안개 분대: 거점전",description:"2인 분대 도트 액션 전략 게임",images:[image]}};
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
