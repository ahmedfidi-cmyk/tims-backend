import type { Metadata } from "next";
import { AuthProvider } from "@/lib/contexts/vendor-auth-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "LAHTHA & CLICK - سوق التكنولوجيا المموثوق",
  description: "منصة موثوقة لبيع وشراء أجهزة أبل مستخدمة بأرخص الأسعار",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className="h-full">
      <body className="min-h-full flex flex-col bg-paper-50 text-ink-900 font-sans">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
