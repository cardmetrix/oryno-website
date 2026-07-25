import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "ORYNO — One App. Endless Possibilities.",
  description:
    "ORYNO is a premium digital services platform for airtime, data, bill payments, virtual numbers, social boosting, and wallet payouts across Africa.",
  keywords: [
    "ORYNO",
    "digital wallet",
    "airtime",
    "data bundles",
    "bill payments",
    "virtual numbers",
    "Africa fintech",
  ],
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/oryno-logo.png", type: "image/png" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    title: "ORYNO — One App. Endless Possibilities.",
    description:
      "The premium digital services app for airtime, data, bills, virtual numbers, and more.",
    type: "website",
    images: [{ url: "/brand/oryno-logo.png", width: 577, height: 592, alt: "ORYNO" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
