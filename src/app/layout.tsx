import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "@/components/layout/ServiceWorkerRegister";
import { AuthProvider } from "@/context/AuthContext";
import { DatabaseProvider } from "@/context/DatabaseContext";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bhawani Enterprises",
  description: "Digital Register and Ledger for Retail Shop",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bhawani Enterprises",
  },
};

export const viewport: Viewport = {
  themeColor: "#1d4ed8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 font-sans">
        <AuthProvider>
          <DatabaseProvider>
            <ServiceWorkerRegister />
            <main className="flex-1 flex flex-col pb-20 max-w-md mx-auto w-full bg-white shadow-xl relative overflow-x-hidden min-h-screen">
              {children}
            </main>
          </DatabaseProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
