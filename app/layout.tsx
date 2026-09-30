import type { Metadata } from "next";
import "./globals.css";
import "./permissions.css";
import "./production-enhancements.css";
import "./responsive-polish.css";
import "./interface-v3.css";

export const metadata: Metadata = {
  title: "FrameFlow",
  description: "Creative production, review and delivery workspace.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
