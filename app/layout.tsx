import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { AdminAuthProvider } from "@/components/providers/AdminAuthProvider";
import { AdminPageMetaProvider } from "@/components/providers/AdminPageMetaProvider";
import { AdminToastProvider } from "@/components/providers/AdminToastProvider";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Memurlar Akademi Admin",
  description: "Memurlar Akademi sistem yönetim paneli",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={manrope.variable}>
      <body>
        <AdminAuthProvider>
          <AdminPageMetaProvider>
            <AdminToastProvider>{children}</AdminToastProvider>
          </AdminPageMetaProvider>
        </AdminAuthProvider>
      </body>
    </html>
  );
}
