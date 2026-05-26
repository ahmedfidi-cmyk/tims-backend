import type { Metadata } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/layout/SiteHeader';

export const metadata: Metadata = {
  title: 'LAHTHA — جهازك الجديد بفاتورة موثقة',
  description: 'متجر أجهزة Apple الجديدة بضمان رسمي وفاتورة معتمدة من ZATCA.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <SiteHeader />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
        <footer className="mt-24 border-t border-ink-900/10 bg-paper-100">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 text-sm text-ink-500">
            <p>© 2026 LAHTHA · جميع الحقوق محفوظة</p>
            <p className="mt-2">منصة شراء أجهزة Apple بفاتورة موثقة. مدعومة بـ Tabby و Tamara.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
