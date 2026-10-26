import { SiteScanner } from "@/components/site-scanner";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Raio-X Digital",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Scanner de SEO, performance, responsividade, acessibilidade e estrutura técnica para sites.",
  url: "https://raio-x-digital-david-ingrid.keenbead17.chatgpt.site",
  offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
  creator: [
    { "@type": "Person", name: "David Xavier", jobTitle: "Desenvolvedor Backend" },
    { "@type": "Person", name: "Ingrid Lira", jobTitle: "Desenvolvedora Frontend" },
  ],
  featureList: [
    "Análise de SEO on-page",
    "Métricas de performance",
    "Verificação de responsividade",
    "Análise de acessibilidade",
    "Diagnóstico de segurança e estrutura técnica",
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteScanner />
    </>
  );
}
