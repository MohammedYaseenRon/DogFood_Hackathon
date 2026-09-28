import type { Metadata } from "next";
import { DM_Sans, Sora } from "next/font/google";
import { Nav } from "@/components/Nav";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  weight: ["400", "500", "600", "700", "800"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Dogfood — Hackathon Portal",
  description:
    "Self-hostable hackathon submission and judging platform. Register teams, submit projects, score submissions, and export results.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sora.variable} ${dmSans.variable}`}>
      <body className="min-h-screen bg-zinc-50 font-sans antialiased">
        <Nav />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
