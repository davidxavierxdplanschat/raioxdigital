# Raio-X Digital

Scanner real de sites criado por **David Xavier (Backend)** e **Ingrid Lira (Frontend)**.

A aplicação valida URLs públicas, lê HTML e headers reais, consulta o Google PageSpeed Insights quando disponível e transforma os dados em um diagnóstico de SEO, performance, responsividade e estrutura técnica.

## Recursos

- Validação e normalização segura de URLs públicas.
- Proteção contra localhost, redes privadas e respostas excessivamente grandes.
- Análise de title, description, headings, canonical, robots, sitemap, Open Graph e JSON-LD.
- Verificação de viewport, media queries, textos alternativos e experiência mobile.
- Auditoria de HTTPS, headers de segurança, cache, compressão e tempo de resposta.
- Integração resiliente com Google PageSpeed Insights/Lighthouse mobile.
- Relatório compartilhável, imprimível e separado entre Backend e Frontend.
- Next.js com metadata, canonical, robots, sitemap e dados estruturados.

## Desenvolvimento

Requisitos: Node.js 22 ou superior.

```bash
npm install
npm run dev
```

Acesse o endereço exibido no terminal.

## Verificações

```bash
npm run lint
npm run build
npm start
```

O endpoint do scanner recebe:

```http
POST /api/scan
Content-Type: application/json

{ "url": "https://exemplo.com" }
```

## Deploy na Vercel

O repositório está configurado como projeto **Next.js nativo**.

- Build Command: `npm run build`
- Output Directory: padrão do Next.js (`.next`)
- Install Command: `npm install`
- Node.js: 22.x
- Root Directory: raiz do repositório

O arquivo `vercel.json` fixa o framework e o comando de build. Não configure `dist` como Output Directory.

Para ampliar a disponibilidade das métricas externas, configure opcionalmente `GOOGLE_PAGESPEED_API_KEY` nas variáveis de ambiente da Vercel. A auditoria própria funciona sem credenciais.

## Fluxo oficial

Toda alteração deve:

1. passar em `npm run lint`;
2. passar em `npm run build`;
3. ser enviada à branch `main` deste repositório;
4. ser publicada pela integração GitHub → Vercel.
