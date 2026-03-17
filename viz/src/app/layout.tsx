import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "IMiC | Milk Composition Visualizer",
  description:
    "Interactive data visualization platform for the IMiC Mammary Gland research project — exploring the molecular landscape of human milk composition.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-[#0a0a0f] text-white antialiased font-sans min-h-screen">
        <Navigation />
        <main>{children}</main>
      </body>
    </html>
  );
}
