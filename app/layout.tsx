import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = "https://raio-x-digital-david-ingrid.keenbead17.chatgpt.site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Raio-X Digital | Scanner real de SEO e Performance",
    template: "%s | Raio-X Digital",
  },
  description:
    "Analise gratuitamente SEO, performance, responsividade, acessibilidade e estrutura técnica do seu site. Scanner criado por David Xavier e Ingrid Lira.",
  keywords: [
    "analisador SEO",
    "scanner de site",
    "teste de performance",
    "site responsivo",
    "auditoria de site",
    "desenvolvedor backend",
    "desenvolvedora frontend",
  ],
  authors: [{ name: "David Xavier" }, { name: "Ingrid Lira" }],
  creator: "David Xavier e Ingrid Lira",
  publisher: "Raio-X Digital",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: siteUrl,
    siteName: "Raio-X Digital",
    title: "Raio-X Digital — seu site passa no teste?",
    description:
      "Scanner real de SEO, performance, responsividade e estrutura técnica para transformar problemas em oportunidades.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Raio-X Digital — Scanner de sites",
    description: "Veja o que está impedindo seu site de atrair mais clientes.",
  },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  category: "technology",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#07020f",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
