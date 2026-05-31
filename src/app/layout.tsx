import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "نظام 3D - عمالة سلا | قسم حفظ الصحة والبيئة",
  description: "نظام تدبير ومتابعة عمليات مكافحة الجرذان ومكافحة الحشرات والتطهير لجماعة بوقنادل سلا",
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
