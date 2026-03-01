import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CloudFS",
  description: "Fast, keyboard-accessible Google Drive interface",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
