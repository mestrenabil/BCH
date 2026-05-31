import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "نظام 3D - مكتب النظافة المشترك | بوقنادل سلا",
  description: "نظام تدبير ومتابعة عمليات الدراقلة ومكافحة الحشرات والتطهير لجماعة بوقنادل سلا",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
