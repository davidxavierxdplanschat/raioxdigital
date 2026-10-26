import { NextResponse } from "next/server";
import type {
  CheckImpact,
  CheckOwner,
  CheckStatus,
  PageSpeedData,
  ScanApiResponse,
  ScanCheck,
  ScanResult,
} from "@/lib/scan-types";

type PageSpeedResponse = {
  lighthouseResult?: {
    categories?: Record<string, { score?: number }>;
    audits?: Record<string, { displayValue?: string; score?: number }>;
  };
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_HTML_BYTES = 1_500_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; RaioXDigital/2.0; +https://raio-x-digital-david-ingrid.keenbead17.chatgpt.site)";

function assertPublicHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const blockedNames = ["localhost", ".localhost", ".local", ".internal", ".lan", ".home", ".test", ".invalid"];
  if (blockedNames.some((suffix) => host === suffix.replace(/^\./, "") || host.endsWith(suffix))) {
    throw new Error("Endereços locais ou internos não podem ser analisados.");
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const octets = host.split(".").map(Number);
    if (octets.some((part) => part > 255)) throw new Error("Endereço IP inválido.");
    const [a, b] = octets;
    const isPrivate =
      a === 0 || a === 10 || a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224;
    if (isPrivate) throw new Error("Endereços de rede privada não podem ser analisados.");
  }

  if (host.includes(":")) {
    const normalized = host.replace(/^0+/, "");
    if (
      normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") ||
      normalized.startsWith("fe8") || normalized.startsWith("fe9") ||
      normalized.startsWith("fea") || normalized.startsWith("feb")
    ) throw new Error("Endereços IPv6 locais não podem ser analisados.");
  }
}

function normalizeUrl(value: unknown): URL {
  if (typeof value !== "string" || !value.trim()) throw new Error("Informe uma URL válida.");
  const trimmed = value.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Use apenas endereços HTTP ou HTTPS.");
  if (url.username || url.password) throw new Error("URLs com usuário ou senha não são permitidas.");
  assertPublicHostname(url.hostname);
  url.hash = "";
  return url;
}

async function fetchWithTimeout(url: string, timeoutMs = 16_000, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        ...init.headers,
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readLimitedText(response: Response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_HTML_BYTES) {
        await reader.cancel();
        throw new Error("A página é grande demais para a análise rápida.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

function attr(tag: string, name: string) {
  const quoted = tag.match(new RegExp(`${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  if (quoted) return quoted[2].trim();
  const bare = tag.match(new RegExp(`${name}\\s*=\\s*([^\\s>]+)`, "i"));
  return bare?.[1]?.trim() ?? null;
}

function tags(html: string, name: string) {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, "gi")) ?? [];
}

function pairedContents(html: string, name: string) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "gi"))]
    .map((match) => match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function metaContent(html: string, key: string) {
  for (const tag of tags(html, "meta")) {
    const identity = attr(tag, "name") ?? attr(tag, "property");
    if (identity?.toLowerCase() === key.toLowerCase()) return attr(tag, "content");
  }
  return null;
}

function linkHref(html: string, rel: string) {
  for (const tag of tags(html, "link")) {
    if ((attr(tag, "rel") ?? "").toLowerCase().split(/\s+/).includes(rel)) return attr(tag, "href");
  }
  return null;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function addCheck(
  checks: ScanCheck[], id: string, label: string, status: CheckStatus, message: string,
  owner: CheckOwner, impact: CheckImpact, value?: string,
) {
  checks.push({ id, label, status, message, owner, impact, value });
}

function scoreChecks(checks: ScanCheck[], ids: string[]) {
  const weights: Record<CheckStatus, number> = { pass: 100, info: 72, warn: 48, fail: 12 };
  const selected = checks.filter((check) => ids.includes(check.id));
  return selected.length
    ? clamp(selected.reduce((sum, check) => sum + weights[check.status], 0) / selected.length)
    : 0;
}

async function smallProbe(url: string) {
  try {
    const response = await fetchWithTimeout(url, 7_000, {
      headers: { Accept: "text/plain,application/xml,text/xml,*/*" },
    });
    assertPublicHostname(new URL(response.url).hostname);
    return {
      ok: response.ok,
      status: response.status,
      text: (await response.text()).slice(0, 120_000),
    };
  } catch {
    return { ok: false, status: 0, text: "" };
  }
}

async function fetchResponsiveCss(html: string, base: URL) {
  const urls = tags(html, "link")
    .filter((tag) => (attr(tag, "rel") ?? "").toLowerCase().includes("stylesheet"))
    .map((tag) => attr(tag, "href"))
    .filter((href): href is string => Boolean(href))
    .map((href) => { try { return new URL(href, base); } catch { return null; } })
    .filter((url): url is URL => url instanceof URL)
    .filter((url) => url.origin === base.origin)
    .slice(0, 4);

  const results = await Promise.allSettled(urls.map(async (url) => {
    const response = await fetchWithTimeout(url.toString(), 6_000, { headers: { Accept: "text/css,*/*" } });
    assertPublicHostname(new URL(response.url).hostname);
    if (!response.ok) return "";
    return (await response.text()).slice(0, 300_000);
  }));
  return results.map((item) => item.status === "fulfilled" ? item.value : "").join("\n");
}

async function getPageSpeed(url: string): Promise<PageSpeedData> {
  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", "mobile");
  endpoint.searchParams.set("locale", "pt_BR");
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;
  if (apiKey) endpoint.searchParams.set("key", apiKey);
  ["PERFORMANCE", "SEO", "ACCESSIBILITY", "BEST_PRACTICES"].forEach((category) => {
    endpoint.searchParams.append("category", category);
  });

  try {
    const response = await fetchWithTimeout(endpoint.toString(), 38_000, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`PageSpeed respondeu ${response.status}`);
    const data = await response.json() as PageSpeedResponse;
    const lighthouse = data.lighthouseResult ?? {};
    const categories = lighthouse.categories ?? {};
    const audits = lighthouse.audits ?? {};
    const categoryScore = (key: string) =>
      typeof categories[key]?.score === "number" ? clamp(categories[key].score * 100) : null;
    const metric = (id: string, label: string) => ({
      label,
      value: audits[id]?.displayValue ?? "não disponível",
      score: typeof audits[id]?.score === "number" ? clamp(audits[id].score * 100) : null,
    });
    return {
      available: true,
      source: "Google PageSpeed Insights",
      performance: categoryScore("performance"),
      seo: categoryScore("seo"),
      accessibility: categoryScore("accessibility"),
      bestPractices: categoryScore("best-practices"),
      metrics: [
        metric("first-contentful-paint", "FCP"),
        metric("largest-contentful-paint", "LCP"),
        metric("cumulative-layout-shift", "CLS"),
        metric("total-blocking-time", "TBT"),
      ],
    };
  } catch (error) {
    return {
      available: false,
      source: "auditoria própria",
      performance: null,
      seo: null,
      accessibility: null,
      bestPractices: null,
      metrics: [],
      note: error instanceof Error ? error.message : "PageSpeed indisponível nesta análise.",
    };
  }
}

function grade(score: number): ScanResult["grade"] {
  if (score >= 85) return "EXCELENTE";
  if (score >= 70) return "BOM";
  if (score >= 50) return "ATENÇÃO";
  return "CRÍTICO";
}

export async function POST(request: Request): Promise<NextResponse<ScanApiResponse>> {
  try {
    const body = await request.json().catch(() => ({})) as { url?: unknown };
    const requested = normalizeUrl(body?.url);
    const startedAt = Date.now();
    const response = await fetchWithTimeout(requested.toString());
    const responseTimeMs = Date.now() - startedAt;
    const finalUrl = new URL(response.url);
    assertPublicHostname(finalUrl.hostname);

    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok) throw new Error(`O site respondeu com o status HTTP ${response.status}.`);
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      throw new Error("O endereço não retornou uma página HTML.");
    }

    const html = await readLimitedText(response);
    const htmlSizeKb = Math.round(new TextEncoder().encode(html).byteLength / 1024);
    const title = pairedContents(html, "title")[0] || null;
    const description = metaContent(html, "description");
    const viewport = metaContent(html, "viewport");
    const robotsMeta = metaContent(html, "robots") ?? "";
    const canonical = linkHref(html, "canonical");
    const h1s = pairedContents(html, "h1");
    const headingCount = ["h1", "h2", "h3", "h4", "h5", "h6"]
      .reduce((sum, tag) => sum + pairedContents(html, tag).length, 0);
    const images = tags(html, "img");
    const imagesWithoutAlt = images.filter((tag) => attr(tag, "alt") === null).length;
    const links = tags(html, "a");
    const structuredData = tags(html, "script")
      .filter((tag) => (attr(tag, "type") ?? "").toLowerCase() === "application/ld+json").length;
    const htmlLang = attr(html.match(/<html\b[^>]*>/i)?.[0] ?? "", "lang");
    const ogReady = Boolean(
      metaContent(html, "og:title") && metaContent(html, "og:description") && metaContent(html, "og:image"),
    );
    const inlineCss = pairedContents(html, "style").join("\n");

    const origin = finalUrl.origin;
    const [robotsProbe, sitemapProbe, externalCss, pageSpeed] = await Promise.all([
      smallProbe(`${origin}/robots.txt`),
      smallProbe(`${origin}/sitemap.xml`),
      fetchResponsiveCss(html, finalUrl),
      getPageSpeed(finalUrl.toString()),
    ]);

    const checks: ScanCheck[] = [];
    const titleLength = title?.length ?? 0;
    addCheck(checks, "title", "Título da página", titleLength >= 30 && titleLength <= 60 ? "pass" : titleLength ? "warn" : "fail", titleLength ? "O título existe; avalie clareza e tamanho para os resultados de busca." : "A página não possui um título detectável.", "SEO", "alto", title ? `${titleLength} caracteres` : "ausente");
    const descriptionLength = description?.length ?? 0;
    addCheck(checks, "description", "Meta description", descriptionLength >= 100 && descriptionLength <= 165 ? "pass" : descriptionLength ? "warn" : "fail", descriptionLength ? "A descrição existe, mas pode precisar de ajuste de tamanho e intenção." : "Inclua uma descrição convincente para melhorar o snippet no Google.", "SEO", "alto", description ? `${descriptionLength} caracteres` : "ausente");
    addCheck(checks, "h1", "Heading principal", h1s.length === 1 ? "pass" : h1s.length > 1 ? "warn" : "fail", h1s.length === 1 ? "A página possui um H1 principal." : `Foram encontrados ${h1s.length} elementos H1.`, "SEO", "alto", `${h1s.length} H1`);
    addCheck(checks, "canonical", "URL canônica", canonical ? "pass" : "warn", canonical ? "A página declara uma URL canônica." : "Adicione rel=canonical para consolidar sinais de indexação.", "SEO", "médio", canonical ?? "ausente");
    const noIndex = /noindex/i.test(robotsMeta) || /noindex/i.test(response.headers.get("x-robots-tag") ?? "");
    addCheck(checks, "robots", "Indexação", noIndex ? "fail" : "pass", noIndex ? "A página solicita que mecanismos de busca não a indexem." : "Nenhum bloqueio noindex foi detectado na página.", "SEO", "alto");
    addCheck(checks, "lang", "Idioma do documento", htmlLang ? "pass" : "warn", htmlLang ? `Idioma declarado como ${htmlLang}.` : "Declare o idioma no elemento HTML para busca e acessibilidade.", "SEO", "médio", htmlLang ?? "ausente");
    addCheck(checks, "robots-file", "Arquivo robots.txt", robotsProbe.ok ? "pass" : "warn", robotsProbe.ok ? "robots.txt encontrado e acessível." : "robots.txt não foi localizado na raiz do domínio.", "SEO", "médio", robotsProbe.status ? `HTTP ${robotsProbe.status}` : "indisponível");
    const sitemapMentioned = /sitemap:/i.test(robotsProbe.text);
    addCheck(checks, "sitemap", "Sitemap XML", sitemapProbe.ok || sitemapMentioned ? "pass" : "warn", sitemapProbe.ok ? "sitemap.xml encontrado na raiz." : sitemapMentioned ? "Um sitemap foi declarado no robots.txt." : "Não encontramos sitemap.xml nem uma declaração no robots.txt.", "SEO", "médio");
    addCheck(checks, "og", "Compartilhamento social", ogReady ? "pass" : "warn", ogReady ? "Open Graph possui título, descrição e imagem." : "Complete as tags Open Graph para compartilhamentos mais atraentes.", "SEO", "baixo");
    addCheck(checks, "schema", "Dados estruturados", structuredData > 0 ? "pass" : "warn", structuredData > 0 ? "JSON-LD detectado na página." : "Nenhum bloco JSON-LD foi detectado.", "SEO", "médio", `${structuredData} bloco(s)`);

    const hasViewport = Boolean(viewport && /width\s*=\s*device-width/i.test(viewport));
    const cssCorpus = `${inlineCss}\n${externalCss}`;
    const hasMediaQueries = /@media[^{]*(max-width|min-width|width)/i.test(cssCorpus);
    addCheck(checks, "viewport", "Viewport mobile", hasViewport ? "pass" : "fail", hasViewport ? "A página adapta a largura ao dispositivo." : "A configuração viewport para celular não foi encontrada.", "Frontend", "alto", viewport ?? "ausente");
    addCheck(checks, "media-queries", "Breakpoints responsivos", hasMediaQueries ? "pass" : "warn", hasMediaQueries ? "Foram detectadas media queries para diferentes telas." : "Não detectamos breakpoints no CSS acessível durante a análise.", "Frontend", "alto");
    addCheck(checks, "image-alt", "Textos alternativos", imagesWithoutAlt === 0 ? "pass" : imagesWithoutAlt <= Math.max(1, images.length * .2) ? "warn" : "fail", imagesWithoutAlt === 0 ? "Todas as imagens detectadas possuem atributo alt." : `${imagesWithoutAlt} de ${images.length} imagens não possuem atributo alt.`, "Frontend", "médio", `${imagesWithoutAlt}/${images.length} sem alt`);
    addCheck(checks, "page-size", "Peso do HTML", htmlSizeKb <= 150 ? "pass" : htmlSizeKb <= 400 ? "warn" : "fail", htmlSizeKb <= 150 ? "O documento HTML inicial é enxuto." : "O HTML inicial pode ser reduzido para acelerar processamento e renderização.", "Frontend", "médio", `${htmlSizeKb} KB`);
    addCheck(checks, "response-time", "Resposta do servidor", responseTimeMs <= 800 ? "pass" : responseTimeMs <= 1800 ? "warn" : "fail", responseTimeMs <= 800 ? "O servidor respondeu rapidamente nesta medição." : "A resposta inicial do servidor pode ser otimizada.", "Backend", "alto", `${responseTimeMs} ms`);

    const isHttps = finalUrl.protocol === "https:";
    addCheck(checks, "https", "Conexão HTTPS", isHttps ? "pass" : "fail", isHttps ? "A conexão utiliza HTTPS." : "A página está sendo servida sem HTTPS.", "Backend", "alto");
    const securityHeaders = ["content-security-policy", "strict-transport-security", "x-content-type-options", "referrer-policy"];
    const presentHeaders = securityHeaders.filter((header) => response.headers.has(header));
    addCheck(checks, "security-headers", "Headers de segurança", presentHeaders.length >= 3 ? "pass" : presentHeaders.length ? "warn" : "fail", `${presentHeaders.length} de ${securityHeaders.length} headers recomendados foram detectados.`, "Backend", "alto", presentHeaders.join(", ") || "nenhum");
    addCheck(checks, "compression", "Compressão de resposta", response.headers.has("content-encoding") ? "pass" : "warn", response.headers.has("content-encoding") ? `Conteúdo entregue com ${response.headers.get("content-encoding")}.` : "Não foi possível confirmar compressão na resposta analisada.", "Backend", "médio", response.headers.get("content-encoding") ?? "não detectada");
    addCheck(checks, "cache", "Política de cache", response.headers.has("cache-control") ? "pass" : "warn", response.headers.has("cache-control") ? "A resposta declara uma política de cache." : "Nenhum header Cache-Control foi detectado.", "Backend", "baixo", response.headers.get("cache-control") ?? "ausente");

    const ownSeo = scoreChecks(checks, ["title", "description", "h1", "canonical", "robots", "lang", "robots-file", "sitemap", "og", "schema"]);
    const ownResponsive = scoreChecks(checks, ["viewport", "media-queries", "image-alt"]);
    const ownTechnical = scoreChecks(checks, ["https", "security-headers", "compression", "cache", "response-time"]);
    const ownPerformance = scoreChecks(checks, ["page-size", "response-time", "compression", "cache"]);
    const seoScore = pageSpeed.seo !== null ? clamp(ownSeo * .6 + pageSpeed.seo * .4) : ownSeo;
    const performanceScore = pageSpeed.performance !== null ? clamp(ownPerformance * .35 + pageSpeed.performance * .65) : ownPerformance;
    const responsiveScore = pageSpeed.accessibility !== null ? clamp(ownResponsive * .75 + pageSpeed.accessibility * .25) : ownResponsive;
    const technicalScore = pageSpeed.bestPractices !== null ? clamp(ownTechnical * .7 + pageSpeed.bestPractices * .3) : ownTechnical;
    const overallScore = clamp(seoScore * .32 + performanceScore * .27 + responsiveScore * .23 + technicalScore * .18);

    const failures = checks.filter((check) => check.status === "fail").length;
    const warnings = checks.filter((check) => check.status === "warn").length;
    const summary = failures
      ? `Encontramos ${failures} ponto${failures > 1 ? "s" : ""} crítico${failures > 1 ? "s" : ""} e ${warnings} oportunidade${warnings !== 1 ? "s" : ""} de melhoria.`
      : warnings
        ? `A base está saudável, com ${warnings} oportunidade${warnings !== 1 ? "s" : ""} para evoluir.`
        : "A análise rápida não encontrou problemas relevantes nos critérios verificados.";

    const result: ScanResult = {
      requestedUrl: requested.toString(),
      finalUrl: finalUrl.toString(),
      scannedAt: new Date().toISOString(),
      statusCode: response.status,
      responseTimeMs,
      htmlSizeKb,
      title,
      overallScore,
      grade: grade(overallScore),
      scores: { seo: seoScore, performance: performanceScore, responsive: responsiveScore, technical: technicalScore },
      counts: { headings: headingCount, images: images.length, imagesWithoutAlt, links: links.length, structuredData },
      pageSpeed,
      checks,
      summary,
    };

    return NextResponse.json({ ok: true, result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError";
    const message = isAbort
      ? "O site demorou demais para responder. Tente novamente em alguns instantes."
      : error instanceof Error ? error.message : "Não foi possível analisar este endereço.";
    return NextResponse.json(
      { ok: false, error: message, code: isAbort ? "TIMEOUT" : "SCAN_ERROR" },
      { status: 400 },
    );
  }
}
