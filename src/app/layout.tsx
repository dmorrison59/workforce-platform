import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Workforce Core", template: "%s | Workforce Core" },
  description: "Secure workforce management foundation for small businesses.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
