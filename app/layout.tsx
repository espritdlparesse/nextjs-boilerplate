import type { Metadata } from "next";
import "./globals.css";
import "./everyyou.css";

export const metadata: Metadata = {
  title: "EveryYou",
  description: "Mini App",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
