import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/hooks/useToast";

export const metadata: Metadata = {
  title: "EV Exec | Airport Transfer Calendar",
  description: "Premium airport transfer management for EV Exec operators.",
  applicationName: "EV Exec Operator",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "EV Exec",
    statusBarStyle: "black",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#E9EBF2",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#E9EBF2] text-[#0F1B33] antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
