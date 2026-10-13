import type { Metadata } from 'next';
import { Work_Sans } from 'next/font/google';
import { SkipLink } from '@/components/layout/PageShell';
import './globals.css';

// Work Sans (OFL), la tipografía de treo.mx. next/font la descarga en el build y la sirve desde
// el propio dominio; globals.css la conecta con --dt-font-sans por esta variable (DSG-05).
const workSans = Work_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-work-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TreoWallet',
  description: 'Tu billetera digital en pesos mexicanos.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es-MX" className={workSans.variable}>
      <body className="min-h-dvh bg-surface font-sans text-body text-fg antialiased">
        <SkipLink />
        {children}
      </body>
    </html>
  );
}
