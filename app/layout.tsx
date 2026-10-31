import type { Metadata } from 'next';
import './globals.css';
import HospitalProvider from '../components/HospitalProvider';

const SAHS_LOGO_PATH =
  '/assets/aistudio/Gemini_Generated_Image_xgunhyxgunhyxgun_8142619c.png';

export const metadata: Metadata = {
  title: 'SAHS — Smart Appointment & Hospital System',
  description:
    'Modern SaaS healthcare platform for hospital appointment scheduling, real-time dual-device QR booking sync, digital arrival check-in passes, and clinical queue management.',
  icons: {
    icon: [
      {
        url: SAHS_LOGO_PATH,
        type: 'image/png',
      },
    ],
    shortcut: SAHS_LOGO_PATH,
    apple: SAHS_LOGO_PATH,
  },
  openGraph: {
    title: 'SAHS — Smart Appointment & Hospital System',
    description:
      'Modern SaaS healthcare platform for hospital appointment scheduling, real-time dual-device QR booking sync, digital arrival check-in passes, and clinical queue management.',
    type: 'website',
    images: [SAHS_LOGO_PATH],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SAHS — Smart Appointment & Hospital System',
    description:
      'Modern SaaS healthcare platform for hospital appointment scheduling, real-time dual-device QR booking sync, digital arrival check-in passes, and clinical queue management.',
    images: [SAHS_LOGO_PATH],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/png" href={SAHS_LOGO_PATH} />
        <link rel="apple-touch-icon" href={SAHS_LOGO_PATH} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Manrope:wght@500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="antialiased selection:bg-[#0F766E] selection:text-white transition-colors duration-200"
        suppressHydrationWarning
      >
        <HospitalProvider>{children}</HospitalProvider>
      </body>
    </html>
  );
}

