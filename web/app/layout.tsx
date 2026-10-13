import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TreoWallet',
  description: 'Tu billetera digital en pesos mexicanos.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
