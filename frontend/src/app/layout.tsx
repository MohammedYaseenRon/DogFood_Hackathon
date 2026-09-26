import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Nav } from "@/components/Nav";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Dogfood Portal",
  description: "Hackathon submission and judging platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-slate-50 font-sans antialiased">
        <Nav />
        {children}
        <footer className="mt-16 border-t border-slate-200 bg-white py-8">
          <div className="mx-auto max-w-6xl px-6 text-center text-sm text-slate-500">
            Dogfood 2026 · Self-hostable hackathon portal
          </div>
        </footer>
      </body>
    </html>
  );
}
