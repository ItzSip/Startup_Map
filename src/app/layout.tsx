import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const metadata: Metadata = { metadataBase:new URL(siteUrl), title:{default:"Bangalore Startup Atlas",template:"%s · Bangalore Startup Atlas"}, description:"Explore verified startups, founders and ideas across Bangalore's technology ecosystem.", openGraph:{title:"Bangalore Startup Atlas",description:"The geographic guide to Bangalore's startup ecosystem.",url:siteUrl,siteName:"Bangalore Startup Atlas",type:"website"}, robots:{index:true,follow:true} };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><Header/><main className="flex-1">{children}</main><Footer/></body>
    </html>
  );
}
