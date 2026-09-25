import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import {
  Bricolage_Grotesque,
  Newsreader,
  Noto_Nastaliq_Urdu,
  Noto_Serif_Bengali,
  Noto_Serif_Devanagari,
  Noto_Serif_Gujarati,
  Noto_Serif_Gurmukhi,
  Noto_Serif_Kannada,
  Noto_Serif_Malayalam,
  Noto_Serif_Oriya,
  Noto_Serif_Tamil,
  Noto_Serif_Telugu,
} from "next/font/google";
import "./globals.css";

const ui = Bricolage_Grotesque({ variable: "--font-ui", subsets: ["latin"] });
const news = Newsreader({ variable: "--font-news", subsets: ["latin"], style: ["normal", "italic"] });
// Indian scripts for Sarvam transcripts. Each is fetched only when its script appears on the page.
const deva = Noto_Serif_Devanagari({ variable: "--font-deva", subsets: ["devanagari"], preload: false });
const beng = Noto_Serif_Bengali({ variable: "--font-beng", subsets: ["bengali"], preload: false });
const taml = Noto_Serif_Tamil({ variable: "--font-taml", subsets: ["tamil"], preload: false });
const telu = Noto_Serif_Telugu({ variable: "--font-telu", subsets: ["telugu"], preload: false });
const knda = Noto_Serif_Kannada({ variable: "--font-knda", subsets: ["kannada"], preload: false });
const mlym = Noto_Serif_Malayalam({ variable: "--font-mlym", subsets: ["malayalam"], preload: false });
const gujr = Noto_Serif_Gujarati({ variable: "--font-gujr", subsets: ["gujarati"], preload: false });
const guru = Noto_Serif_Gurmukhi({ variable: "--font-guru", subsets: ["gurmukhi"], preload: false });
const orya = Noto_Serif_Oriya({ variable: "--font-orya", subsets: ["oriya"], preload: false });
const urdu = Noto_Nastaliq_Urdu({ variable: "--font-urdu", subsets: ["arabic"], preload: false });
const indic = [deva, beng, taml, telu, knda, mlym, gujr, guru, orya, urdu];

export const metadata: Metadata = {
  title: "Tangent",
  description: "Talk in English or an Indian language, and Jev highlights the topic of every phrase while you're still speaking.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={[ui, news, ...indic].map((f) => f.variable).join(" ")}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
