import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project Template",
  description: "Next.js + Fastify + BullMQ project template"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
