import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Bricolage_Grotesque, Newsreader } from "next/font/google";
import "./globals.css";

const ui = Bricolage_Grotesque({ variable: "--font-ui", subsets: ["latin"] });
const reading = Newsreader({ variable: "--font-reading", subsets: ["latin"], style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "Tangent",
  description: "Talk, and Jev highlights the topic of every phrase while you're still speaking.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${ui.variable} ${reading.variable}`}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
