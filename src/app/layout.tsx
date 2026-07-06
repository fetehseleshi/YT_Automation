import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthSessionProvider } from "@/components/auth-session-provider";
import { AuthGate } from "@/components/auth-gate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "My YT Automation Studio",
  description:
    "A premium personal operating system for managing your YouTube automation business — channels, content, analytics, finance, and AI.",
  keywords: [
    "YouTube automation",
    "content studio",
    "creator dashboard",
    "video planner",
    "analytics",
  ],
  authors: [{ name: "YT Automation Studio" }],
  icons: {
    icon: "https://i.ibb.co/M5KZx2W6/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AuthSessionProvider>
            <AuthGate>
              {children}
            </AuthGate>
            <Toaster />
            <SonnerToaster position="bottom-right" richColors closeButton />
          </AuthSessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
