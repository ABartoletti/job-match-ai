import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Match AI",
  description: "CV-based job search assistant for LinkedIn and open job sources.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
