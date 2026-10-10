import './receipts.css';
import type { Metadata } from "next";
import "./globals.css";
import "./refinement.css";
import "./catalog.css";
import "./commerce.css";
import "./order-status.css";
import "./ai-price.css";

export const metadata: Metadata = {
  title: "Adela's Purchasing Agent｜韓國代購",
  description: "Adela's Purchasing Agent，韓國選品、會員優惠與訂單進度。",
  manifest: "/manifest.webmanifest",
  appleWebApp: {capable:true,title:"Adela’s",statusBarStyle:"default"},
  icons: {
    apple: "/app-icon.png",
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body className="antialiased">{children}</body>
    </html>
  );
}
