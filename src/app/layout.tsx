import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { RootProviders } from "@/components/RootProviders";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Slate",
  description: "A real-time collaborative whiteboard that feels alive.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.variable} h-full font-sans antialiased transition-colors duration-200`}>
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
