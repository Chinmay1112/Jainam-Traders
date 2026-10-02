import type { Metadata, Viewport } from 'next';
import { Inter, Outfit } from 'next/font/google';
import './globals.css';
import { ShopProvider } from '@/lib/context/shop-context';
import { AuthProvider } from '@/lib/context/auth-context';
import { CartProvider } from '@/lib/context/cart-context';
import { WishlistProvider } from '@/lib/context/wishlist-context';
import { SimpleModeProvider } from '@/lib/context/simple-mode-context';
import { LanguageProvider } from '@/lib/context/language-context';
import Header from '@/components/layout/header';
import MobileBottomNav from '@/components/layout/mobile-bottom-nav';
import Footer from '@/components/layout/footer';
import CartDrawer from '@/components/cart/cart-drawer';
import AiSupportModal from '@/components/support/ai-support-modal';
import ServiceWorkerRegister from '@/components/layout/sw-register';
import NativeInitializer from '@/components/native/native-initializer';
import OfflineBanner from '@/components/native/offline-banner';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#B84A1C',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'Jainam Traders | Gifts • Toys • Accessories • More | Retail Store',
  description:
    'Jainam Traders — GIFTS • TOYS • ACCESSORIES • MORE. Discover & reserve gifts, photo frames, wall clocks, watches, leather purses, toys, and stationery online. Inspect and pay at our physical retail store.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/icon-192x192.png',
  },
  openGraph: {
    title: 'Jainam Traders - Local Gift & Retail Pickup Store',
    description: 'Reserve online, pick up and pay at our local retail store.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="min-h-screen flex flex-col bg-[#FAF8F5] text-stone-900 antialiased selection:bg-brand-500 selection:text-white pb-20 md:pb-0">
        <ShopProvider>
          <LanguageProvider>
            <AuthProvider>
              <CartProvider>
                <WishlistProvider>
                  <SimpleModeProvider>
                    <NativeInitializer />
                    <OfflineBanner />
                    <ServiceWorkerRegister />
                    <Header />
                    <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                      {children}
                    </main>
                    <Footer />
                    <CartDrawer />
                    <AiSupportModal />
                    <MobileBottomNav />
                  </SimpleModeProvider>
                </WishlistProvider>
              </CartProvider>
            </AuthProvider>
          </LanguageProvider>
        </ShopProvider>
      </body>
    </html>
  );
}
