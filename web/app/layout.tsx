import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { QueryProvider } from '@/components/providers/QueryProvider';
import './globals.css';

// Work Sans (OFL, ver fonts/OFL.txt), la tipografía de treo.mx: la variable de pesos de Google Fonts
// (v24, subconjunto latino), versionada en fonts/. Google Fonts entrega otra compilación según el
// navegador que la pide, con otros anchos de letra; con el archivo en el repositorio, la app y el
// lienzo de design-sync (.design-sync/fonts.css) dibujan el mismo texto (WEB-25). next/font la sirve
// desde el propio dominio y globals.css la conecta con --dt-font-sans por esta variable (DSG-05).
const workSans = localFont({
  src: './fonts/WorkSans-latin.woff2',
  weight: '400 600',
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
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
