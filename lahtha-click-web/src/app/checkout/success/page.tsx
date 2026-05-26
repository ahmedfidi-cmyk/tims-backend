import Link from 'next/link';

export default function CheckoutSuccessPage() {
  return (
    <div className="py-24 max-w-md mx-auto text-center">
      <div className="w-16 h-16 rounded-full bg-gold-100 text-gold-500 flex items-center justify-center mx-auto text-3xl">
        ✓
      </div>
      <h1 className="mt-6 text-3xl font-bold">تم الطلب بنجاح</h1>
      <p className="mt-3 text-ink-500 leading-relaxed">
        ستصلك رسالة تأكيد على البريد والجوال خلال دقائق، مع رابط فاتورة ZATCA الرسمية.
      </p>

      <div className="mt-8 p-4 rounded-lg bg-paper-100 text-right">
        <h2 className="font-medium text-sm">الخطوات التالية</h2>
        <ol className="mt-2 space-y-2 text-sm text-ink-700">
          <li>1. يصلك إشعار بتجهيز الجهاز خلال 24 ساعة</li>
          <li>2. اختر الاستلام من الفرع أو الشحن لباب البيت</li>
          <li>3. عند الاستلام، يُسجَّل IMEI باسمك في النظام</li>
        </ol>
      </div>

      <div className="mt-8 flex flex-wrap gap-3 justify-center">
        <Link href="/" className="btn-primary">
          العودة للرئيسية
        </Link>
        <Link href="/devices" className="btn-secondary">
          متابعة التسوق
        </Link>
      </div>

      <p className="mt-6 text-xs text-ink-500">
        رقم الطلب التجريبي:{' '}
        <span className="font-mono" dir="ltr">
          LZA-DEMO-12345678
        </span>
      </p>
    </div>
  );
}
