"use client";

import Image from "next/image";
import {
  Activity, AlertTriangle, ArrowDown, ArrowRight, Braces, Check, CheckCircle2,
  CircleX, Copy, Gauge, Globe2, Layers3, LoaderCircle,
  LockKeyhole, MonitorSmartphone, Search, ServerCog, Share2, ShieldCheck,
  Terminal, WandSparkles, Zap,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { CheckOwner, CheckStatus, ScanApiResponse, ScanResult } from "@/lib/scan-types";

const scanStages = [
  "Validando endereço e conexão…",
  "Lendo HTML, headings e metadados…",
  "Procurando sinais de responsividade…",
  "Consultando métricas de performance…",
  "Organizando prioridades técnicas…",
];

const categories = [
  { key: "seo", label: "SEO", icon: Search },
  { key: "performance", label: "Performance", icon: Gauge },
  { key: "responsive", label: "Responsivo", icon: MonitorSmartphone },
  { key: "technical", label: "Estrutura", icon: ServerCog },
] as const;

const statusLabel: Record<CheckStatus, string> = {
  pass: "aprovado",
  warn: "atenção",
  fail: "crítico",
  info: "informação",
};

function ScoreRing({ score, label, large = false }: { score: number; label: string; large?: boolean }) {
  const tone = score >= 80 ? "good" : score >= 55 ? "warning" : "danger";
  return (
    <div className={`score-orbit ${large ? "score-orbit--large" : ""} score-orbit--${tone}`} style={{ "--score": `${score * 3.6}deg` } as React.CSSProperties}>
      <div className="score-orbit__inner"><strong>{score}</strong><span>/100</span><small>{label}</small></div>
    </div>
  );
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "pass") return <CheckCircle2 aria-hidden="true" />;
  if (status === "fail") return <CircleX aria-hidden="true" />;
  if (status === "warn") return <AlertTriangle aria-hidden="true" />;
  return <Activity aria-hidden="true" />;
}

function ScannerLoader({ stage }: { stage: number }) {
  return (
    <div className="scanner-loader" role="status" aria-live="polite">
      <div className="radar">
        <span className="radar__line" />
        <span className="radar__dot radar__dot--one" />
        <span className="radar__dot radar__dot--two" />
        <Search aria-hidden="true" />
      </div>
      <p className="terminal-prefix">scan://running</p>
      <h3>{scanStages[stage]}</h3>
      <div className="stage-list">
        {scanStages.map((item, index) => (
          <span key={item} className={index < stage ? "done" : index === stage ? "active" : ""}>
            {index < stage ? <Check aria-hidden="true" /> : index === stage ? <LoaderCircle className="spin" aria-hidden="true" /> : <span className="stage-dot" />}
            {item.replace("…", "")}
          </span>
        ))}
      </div>
    </div>
  );
}

function ResultDashboard({ result, onReset }: { result: ScanResult; onReset: () => void }) {
  const [filter, setFilter] = useState<"Todos" | CheckOwner>("Todos");
  const [copied, setCopied] = useState(false);
  const priorities = useMemo(() => result.checks
    .filter((check) => check.status === "fail" || check.status === "warn")
    .sort((a, b) => {
      const statusWeight = { fail: 0, warn: 1, info: 2, pass: 3 };
      const impactWeight = { alto: 0, médio: 1, baixo: 2 };
      return statusWeight[a.status] - statusWeight[b.status] || impactWeight[a.impact] - impactWeight[b.impact];
    }), [result]);
  const visibleChecks = filter === "Todos" ? result.checks : result.checks.filter((check) => check.owner === filter);

  const shareText = `Raio-X Digital: ${result.overallScore}/100 (${result.grade})\n${result.finalUrl}\nSEO ${result.scores.seo} · Performance ${result.scores.performance} · Responsivo ${result.scores.responsive} · Estrutura ${result.scores.technical}`;

  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: "Meu Raio-X Digital", text: shareText, url: location.href });
      else {
        await navigator.clipboard.writeText(`${shareText}\n${location.href}`);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2200);
      }
    } catch { /* o visitante pode cancelar o compartilhamento */ }
  }

  return (
    <section className="results" id="resultado" aria-labelledby="results-title">
      <div className="results__command"><span>$</span> raio-x scan --url <b>{new URL(result.finalUrl).hostname}</b><i>exit 0</i></div>
      <div className="results__hero glass-panel">
        <div className="results__copy">
          <p className="terminal-prefix">scan://complete</p>
          <h2 id="results-title">Diagnóstico concluído<span className="cursor">_</span></h2>
          <p>{result.summary}</p>
          <a href={result.finalUrl} target="_blank" rel="noreferrer"><Globe2 aria-hidden="true" /> {result.finalUrl}</a>
          <div className="scan-facts">
            <span><CheckCircle2 /> HTTP {result.statusCode}</span>
            <span><Zap /> {result.responseTimeMs} ms</span>
            <span><Braces /> {result.htmlSizeKb} KB HTML</span>
            <span><ShieldCheck /> {result.finalUrl.startsWith("https") ? "HTTPS" : "Sem HTTPS"}</span>
          </div>
        </div>
        <ScoreRing score={result.overallScore} label={result.grade} large />
      </div>

      <div className="score-grid">
        {categories.map(({ key, label, icon: Icon }) => (
          <article className="metric-card glass-panel" key={key}>
            <div><Icon aria-hidden="true" /><span>{label}</span></div>
            <strong>{result.scores[key]}</strong>
            <div className="meter"><i style={{ width: `${result.scores[key]}%` }} /></div>
          </article>
        ))}
      </div>

      <div className="source-line">
        <span className={result.pageSpeed.available ? "source-live" : "source-fallback"} />
        Métricas: <b>{result.pageSpeed.source}</b>
        {!result.pageSpeed.available && <small>O Google não respondeu nesta execução; as notas usam a auditoria própria.</small>}
      </div>

      {result.pageSpeed.metrics.length > 0 && (
        <section className="web-vitals glass-panel" aria-labelledby="vitals-title">
          <div className="section-minihead"><div><p className="terminal-prefix">google://lighthouse-mobile</p><h3 id="vitals-title">Métricas essenciais</h3></div><span>fonte externa</span></div>
          <div className="vitals-grid">
            {result.pageSpeed.metrics.map((metric) => <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.score === null ? "sem nota" : `${metric.score}/100`}</small></div>)}
          </div>
        </section>
      )}

      <section className="priority-panel glass-panel" aria-labelledby="priority-title">
        <div className="section-minihead">
          <div><p className="terminal-prefix">issues://priority</p><h3 id="priority-title">Fila de correções</h3></div>
          <span>{priorities.length} oportunidades</span>
        </div>
        {priorities.length ? (
          <ol className="priority-list">
            {priorities.slice(0, 6).map((check, index) => (
              <li key={check.id}>
                <span className={`priority-index priority-index--${check.status}`}>{String(index + 1).padStart(2, "0")}</span>
                <div><b>{check.label}</b><p>{check.message}</p></div>
                <div className="priority-tags"><span>{check.owner}</span><small>impacto {check.impact}</small></div>
              </li>
            ))}
          </ol>
        ) : <div className="empty-state"><CheckCircle2 /><p>Nenhuma correção prioritária nesta análise rápida.</p></div>}
      </section>

      <section className="checks-panel" aria-labelledby="checks-title">
        <div className="section-minihead"><div><p className="terminal-prefix">report://all-checks</p><h3 id="checks-title">Todos os testes</h3></div></div>
        <div className="filter-row" role="group" aria-label="Filtrar testes">
          {(["Todos", "SEO", "Frontend", "Backend"] as const).map((item) => (
            <button key={item} type="button" className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>
          ))}
        </div>
        <div className="checks-grid">
          {visibleChecks.map((check) => (
            <article className={`check-card check-card--${check.status}`} key={check.id}>
              <div className="check-card__icon"><StatusIcon status={check.status} /></div>
              <div><div className="check-card__title"><h4>{check.label}</h4><span>{statusLabel[check.status]}</span></div><p>{check.message}</p>{check.value && <code>{check.value}</code>}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="specialist-route glass-panel" aria-labelledby="route-title">
        <div className="section-minihead"><div><p className="terminal-prefix">route://specialists</p><h3 id="route-title">Quem entra no código?</h3></div></div>
        <div className="specialist-grid">
          <article>
            <div className="dev-avatar dev-avatar--david">DX</div>
            <div><small>Backend · Infra · APIs</small><h4>David Xavier</h4><p>Para resposta lenta, segurança, headers, integrações, cache e arquitetura.</p></div>
            <ServerCog aria-hidden="true" />
          </article>
          <article>
            <div className="dev-avatar dev-avatar--ingrid">IL</div>
            <div><small>Frontend · UI · UX</small><h4>Ingrid Lira</h4><p>Para responsividade, acessibilidade, performance visual e conversão.</p></div>
            <MonitorSmartphone aria-hidden="true" />
          </article>
        </div>
      </section>

      <div className="result-actions">
        <button className="neon-button" type="button" onClick={share}>{copied ? <Check /> : <Share2 />}{copied ? "Copiado" : "Compartilhar relatório"}</button>
        <button className="ghost-button" type="button" onClick={() => window.print()}><Copy /> Salvar em PDF</button>
        <button className="text-button" type="button" onClick={onReset}>Analisar outro site</button>
      </div>
      <p className="result-disclaimer">Auditoria automatizada baseada na resposta pública do site e, quando disponível, no Google PageSpeed Insights. Resultados variam por rede, servidor e momento da medição.</p>
    </section>
  );
}

export function SiteScanner() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(() => setStage((current) => Math.min(current + 1, scanStages.length - 1)), 1700);
    return () => window.clearInterval(timer);
  }, [loading]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!url.trim()) { setError("Digite o endereço do site que deseja analisar."); return; }
    setError(""); setLoading(true); setStage(0); setResult(null);
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await response.json() as ScanApiResponse;
      if (!data.ok) throw new Error(data.error);
      setResult(data.result);
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível executar a análise.");
    } finally { setLoading(false); }
  }

  function reset() {
    setResult(null); setError(""); setStage(0); setUrl("");
    document.querySelector("#scanner")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <main>
      <div className="noise" aria-hidden="true" />
      <header className="topbar">
        <a href="#inicio" className="logo" aria-label="Raio-X Digital — início"><Image className="brand-logo" src="/brand/raio-x-digital-logo.png" alt="Raio-X Digital" width={180} height={60} priority /><code>v2.0</code></a>
        <nav aria-label="Navegação principal"><a href="#scanner">Scanner</a><a href="#stack">Como funciona</a><a href="#devs">Devs</a></nav>
        <a href="#scanner" className="topbar-cta"><span /> iniciar scan</a>
      </header>

      <section className="hero" id="inicio">
        <div className="hero__grid" aria-hidden="true" />
        <div className="hero__glow hero__glow--one" aria-hidden="true" />
        <div className="hero__glow hero__glow--two" aria-hidden="true" />
        <div className="hero__content">
          <div className="hero__eyebrow"><span className="live-dot" /> SYSTEM ONLINE <i>{"// scanner real de sites"}</i></div>
          <h1>Seu site sob o olhar de quem <span>constrói a web.</span></h1>
          <p>URL, SEO, performance, responsividade e estrutura técnica. Um diagnóstico real, sem achismo e traduzido em ações que podem gerar mais clientes.</p>
          <div className="hero__signals"><span><Terminal /> HTML REAL</span><span><Gauge /> PAGESPEED</span><span><ShieldCheck /> SAFE SCAN</span></div>

          <div className="scanner-shell" id="scanner">
            <div className="terminal-bar"><div><i /><i /><i /></div><code>root@raio-x:~/scanner</code><span>TLS</span></div>
            {!loading ? (
              <form onSubmit={submit} className="scan-form">
                <label htmlFor="site-url">Cole a URL do site para iniciar</label>
                <div className="url-field"><Globe2 aria-hidden="true" /><span>https://</span><input id="site-url" type="text" inputMode="url" autoComplete="url" spellCheck="false" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="seusite.com.br" aria-describedby="url-help scan-error" /><button type="submit">SCAN <ArrowRight /></button></div>
                <div className="scan-meta" id="url-help"><span><LockKeyhole /> Nenhum login necessário</span><span><Activity /> Análise pública e segura</span><span><Zap /> Resultado em instantes</span></div>
                {error && <div className="scan-error" id="scan-error" role="alert"><AlertTriangle /> {error}</div>}
              </form>
            ) : <ScannerLoader stage={stage} />}
          </div>

          <a className="scroll-cue" href="#stack"><span>explorar stack</span><ArrowDown /></a>
        </div>
      </section>

      <div ref={resultRef}>{result && <ResultDashboard result={result} onReset={reset} />}</div>

      {!result && (
        <>
          <section className="stack-section" id="stack">
            <div className="section-heading"><p className="terminal-prefix">pipeline://inspection</p><h2>O que passa pelo scanner<span>_</span></h2><p>Uma leitura combinada do documento, da resposta do servidor e de serviços públicos de medição.</p></div>
            <div className="stack-grid">
              <article><Search /><code>01 / SEO</code><h3>Busca & conteúdo</h3><p>Title, description, headings, canonical, indexação, sitemap, Open Graph e JSON-LD.</p><span>owner: estratégia</span></article>
              <article><Gauge /><code>02 / SPEED</code><h3>Performance real</h3><p>Resposta do servidor, peso do HTML, compressão, cache e métricas Lighthouse mobile.</p><span>owner: David + Ingrid</span></article>
              <article><MonitorSmartphone /><code>03 / UI</code><h3>Responsividade</h3><p>Viewport, breakpoints, imagens acessíveis e sinais de experiência em telas menores.</p><span>owner: Ingrid</span></article>
              <article><ServerCog /><code>04 / CORE</code><h3>Estrutura técnica</h3><p>HTTPS, headers de segurança, política de cache, status HTTP e integridade da resposta.</p><span>owner: David</span></article>
            </div>
          </section>

          <section className="code-section">
            <div className="code-window" aria-hidden="true">
              <div className="terminal-bar"><div><i /><i /><i /></div><code>audit.engine.ts</code><span>READ ONLY</span></div>
              <pre><span className="purple">const</span> opportunity = <span className="purple">await</span> scan(url, {'{'}{`\n`}  seo: <b>true</b>,{`\n`}  performance: <b>true</b>,{`\n`}  responsive: <b>true</b>,{`\n`}  security: <b>true</b>{`\n`}{'}'});{`\n\n`}<i>{"// problema detectado não é sentença"}</i>{`\n`}return <span className="green">buildBetter(opportunity)</span>;</pre>
            </div>
            <div className="code-copy"><p className="terminal-prefix">method://transparent</p><h2>Ferramenta útil.<br />Relatório honesto.</h2><p>Se o Google PageSpeed estiver indisponível, nós avisamos. A auditoria própria continua analisando o HTML e os headers reais — sem inventar métricas externas.</p><ul><li><Check /> Não acessa áreas privadas</li><li><Check /> Não armazena senhas</li><li><Check /> Não promete posição no Google</li></ul></div>
          </section>

          <section className="dev-section" id="devs">
            <div className="section-heading"><p className="terminal-prefix">team://two-sides-one-build</p><h2>Backend forte. Frontend afiado<span>_</span></h2><p>O scanner identifica a origem do problema e direciona a solução para quem domina aquela camada.</p></div>
            <div className="dev-grid">
              <article className="dev-card dev-card--david"><div className="dev-card__top"><div className="dev-avatar dev-avatar--david">DX</div><ServerCog /></div><p>BACKEND ENGINEER</p><h3>David Xavier</h3><span>APIs · Integrações · Dados · Segurança</span><div className="dev-console"><code>$ owner --backend</code><b>systems_online: true</b><b>latency_target: low</b><b>security_mode: strict</b></div></article>
              <div className="merge-symbol"><GitMergeIcon /><span>MERGE</span></div>
              <article className="dev-card dev-card--ingrid"><div className="dev-card__top"><div className="dev-avatar dev-avatar--ingrid">IL</div><MonitorSmartphone /></div><p>FRONTEND ENGINEER</p><h3>Ingrid Lira</h3><span>Interface · UX · Acessibilidade · Performance</span><div className="dev-console"><code>$ owner --frontend</code><b>responsive: true</b><b>interface: accessible</b><b>experience: sharp</b></div></article>
            </div>
          </section>

          <section className="final-banner"><div><p className="terminal-prefix">ready://when-you-are</p><h2>Seu site passa no teste?</h2><p>Execute o scanner. Entenda os gargalos. Decida o próximo commit.</p></div><a href="#scanner" className="neon-button"><WandSparkles /> Rodar análise gratuita</a></section>
        </>
      )}

      <footer><a href="#inicio" className="logo"><Image className="brand-logo" src="/brand/raio-x-digital-logo.png" alt="Raio-X Digital" width={180} height={60} /></a><p>Construído por <strong>David Xavier</strong> × <strong>Ingrid Lira</strong></p><code>© {new Date().getFullYear()} · build with intent</code></footer>
    </main>
  );
}

function GitMergeIcon() {
  return <div className="merge-lines" aria-hidden="true"><span /><span /><Layers3 /></div>;
}
