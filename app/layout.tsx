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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=block"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
