import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { AuthProvider } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ProbePal - Research Assistant',
  description: 'AI-powered research assistant for analyzing documents and surveys',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <SubscriptionProvider>
            {children}
            <Analytics />
          </SubscriptionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
