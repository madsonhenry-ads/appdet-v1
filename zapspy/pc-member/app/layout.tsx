import type React from "react"
import { GoogleTagManager } from "@next/third-parties/google"
import Script from "next/script"
import { Space_Grotesk, Manrope } from "next/font/google"
// ✅ ROUTE CLEANUP - May 2026 - removing all user authentication
import "./globals.css"

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["400", "500", "600", "700"],
})

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700"],
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark ${spaceGrotesk.variable} ${manrope.variable}`}>
      <head>
        <GoogleTagManager gtmId="GTM-PK6HB293" />
        <Script
          type="text/javascript"
          src="https://app.monetizze.com.br/upsell_incorporado.php"
          strategy="beforeInteractive"
        />
      </head>
      <body className="dark bg-[#0a0e27]">
        {/* Cleanup: Remove any auth cookies/storage that might persist */}
        <script dangerouslySetInnerHTML={{
          __html: `
            try {
              localStorage.removeItem('dashboardUser');
            } catch(e) {}
            try {
              document.cookie.split(";").forEach(function(c) {
                document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
              });
            } catch(e) {}
          `
        }} />
        {children}
      </body>
    </html>
  )
}

export const metadata = {
  generator: "v0.app",
}
