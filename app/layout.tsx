import type { Metadata } from "next";
import { Hanken_Grotesk, Libre_Caslon_Text, JetBrains_Mono } from "next/font/google";
import "@/styles/globals.css";
import AppShell from "@/components/layout/AppShell";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  weight: ["400", "600", "700"],
  display: "swap",
});

const libreCaslonText = Libre_Caslon_Text({
  subsets: ["latin"],
  variable: "--font-libre",
  weight: ["400", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-data",
  weight: ["500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hesap G | E-Ticaret Finansal Kontrol Merkezi",
  description: "E-ticaret satıcıları için premium net maliyet motoru, kâr analizi ve karar destek sistemi.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className="dark" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${hankenGrotesk.variable} ${libreCaslonText.variable} ${jetbrainsMono.variable} min-h-screen bg-background font-sans antialiased text-foreground`}>
        <ThemeProvider>
          <AppShell>
            {children}
          </AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
