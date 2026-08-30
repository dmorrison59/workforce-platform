import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "YardClock", template: "%s | YardClock" },
  description: "YardClock: scheduling, GPS time clock, and crew tools for small field businesses.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
