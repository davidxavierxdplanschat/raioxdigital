const form = document.querySelector('#diagnostic-form');
const steps = [...document.querySelectorAll('.form-step')];
const nextButton = document.querySelector('#next-step');
const prevButton = document.querySelector('#prev-step');
const submitButton = document.querySelector('#submit-form');
const errorBox = document.querySelector('#form-error');
const progressBar = document.querySelector('#progress-bar');
const progressLabel = document.querySelector('#progress-label');
let currentStep = 0;

const categoryConfig = {
  seo: { label: 'SEO & presença', fields: ['google', 'content'], description: 'Como o negócio pode ser encontrado e compreendido.' },
  performance: { label: 'Performance', fields: ['speed', 'mobile'], description: 'Rapidez e adaptação para diferentes dispositivos.' },
  experience: { label: 'Experiência', fields: ['cta', 'accessibility'], description: 'Clareza, facilidade de uso e capacidade de conversão.' },
  structure: { label: 'Estrutura técnica', fields: ['https', 'integration'], description: 'Segurança e preparo para automações e crescimento.' }
};

const recommendationsMap = {
  google: ['Melhore sua presença nas buscas', 'Revise títulos, descrições e páginas que respondem às dúvidas dos clientes.', 'SEO'],
  content: ['Crie uma rotina simples de conteúdo', 'Publique respostas úteis e mantenha serviços, preços e contatos atualizados.', 'SEO'],
  speed: ['Reduza o tempo de carregamento', 'Otimize imagens, fontes e scripts antes de adicionar novos recursos.', 'Frontend'],
  mobile: ['Priorize a experiência no celular', 'Ajuste navegação, tamanhos de toque, textos e formulários para telas menores.', 'Frontend'],
  cta: ['Deixe o próximo passo evidente', 'Use uma chamada principal clara e repita o contato nos pontos de decisão.', 'Frontend'],
  accessibility: ['Torne a interface mais acessível', 'Revise contraste, hierarquia, textos alternativos e navegação por teclado.', 'Frontend'],
  https: ['Reforce segurança e confiança', 'Configure HTTPS, cabeçalhos de segurança, atualizações e rotinas de backup.', 'Backend'],
  integration: ['Conecte o site à operação', 'Mapeie tarefas manuais que podem virar integrações, APIs ou automações.', 'Backend']
};

function updateStep() {
  steps.forEach((step, index) => step.classList.toggle('active', index === currentStep));
  progressLabel.textContent = `Etapa ${currentStep + 1} de ${steps.length}`;
  progressBar.style.width = `${((currentStep + 1) / steps.length) * 100}%`;
  prevButton.classList.toggle('hidden', currentStep === 0);
  nextButton.classList.toggle('hidden', currentStep === steps.length - 1);
  submitButton.classList.toggle('hidden', currentStep !== steps.length - 1);
  errorBox.textContent = '';
}

function validateStep() {
  const required = [...steps[currentStep].querySelectorAll('[required]')];
  const names = [...new Set(required.map(field => field.name))];
  const missing = names.some(name => {
    const group = [...steps[currentStep].querySelectorAll(`[name="${name}"]`)];
    return group[0].type === 'radio' ? !group.some(field => field.checked) : !group[0].value;
  });
  if (missing) {
    errorBox.textContent = 'Responda todas as perguntas desta etapa para continuar.';
    const firstMissing = required.find(field => field.type !== 'radio' ? !field.value : !steps[currentStep].querySelector(`[name="${field.name}"]:checked`));
    firstMissing?.focus();
    return false;
  }
  return true;
}

nextButton.addEventListener('click', () => {
  if (!validateStep()) return;
  currentStep += 1;
  updateStep();
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

prevButton.addEventListener('click', () => {
  currentStep -= 1;
  updateStep();
});

function valueOf(data, field) { return Number(data.get(field) || 0); }

function scoreCategory(data, fields) {
  const points = fields.reduce((sum, field) => sum + valueOf(data, field), 0);
  return Math.round((points / (fields.length * 2)) * 100);
}

function statusFor(score) {
  if (score >= 80) return 'Ponto forte';
  if (score >= 55) return 'Pode evoluir';
  return 'Prioridade';
}

function buildShareText(result) {
  return `Meu Raio-X Digital: ${result.total}/100\nSEO: ${result.scores.seo}\nPerformance: ${result.scores.performance}\nExperiência: ${result.scores.experience}\nEstrutura técnica: ${result.scores.structure}\n\nPrioridades:\n${result.recommendations.map((item, i) => `${i + 1}. ${item[0]}`).join('\n')}`;
}

function renderResults(data) {
  const scores = Object.fromEntries(Object.entries(categoryConfig).map(([key, config]) => [key, scoreCategory(data, config.fields)]));
  const total = Math.round(Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.keys(scores).length);
  const fieldScores = Object.keys(recommendationsMap).map(field => [field, valueOf(data, field)]).sort((a, b) => a[1] - b[1]);
  const recommendations = fieldScores.slice(0, 4).map(([field]) => recommendationsMap[field]);
  const needs = [...new Set(recommendations.map(item => item[2]))];
  const result = { total, scores, recommendations, needs };

  document.querySelector('#result-score strong').textContent = total;
  document.querySelector('#result-summary').textContent = total >= 80
    ? 'Sua base digital parece saudável. Agora o foco pode ser ganhar alcance e testar melhorias de conversão.'
    : total >= 55
      ? 'Você já tem uma base importante, mas alguns ajustes podem tornar o site mais fácil de encontrar e usar.'
      : 'Existem oportunidades claras para fortalecer confiança, visibilidade e experiência antes de investir em mais tráfego.';

  document.querySelector('#result-grid').innerHTML = Object.entries(categoryConfig).map(([key, config]) => `
    <article class="result-card"><div class="result-card-head"><h3>${config.label}</h3><b>${scores[key]}</b></div><span><i style="width:${scores[key]}%"></i></span><p>${statusFor(scores[key])} — ${config.description}</p></article>`).join('');

  document.querySelector('#priority-count').textContent = `${recommendations.length} prioridades`;
  document.querySelector('#recommendations').innerHTML = recommendations.map(item => `<li><div><b>${item[0]}</b><p>${item[1]}</p></div><span>${item[2]}</span></li>`).join('');

  const specialists = needs.includes('Backend') && needs.includes('Frontend') ? ['David + Ingrid'] : needs.includes('Backend') ? ['David Xavier'] : needs.includes('Frontend') ? ['Ingrid Lira'] : ['David + Ingrid'];
  document.querySelector('#specialist-match').innerHTML = `<p><b>Melhor combinação para este cenário:</b><br>${specialists[0]} pode${specialists[0].includes('+') ? 'm' : ''} transformar as prioridades em um plano técnico.</p><div class="specialist-badges">${needs.map(need => `<span>${need}</span>`).join('')}</div>`;

  form.classList.add('hidden');
  document.querySelector('.diagnostic-intro').classList.add('hidden');
  const results = document.querySelector('#results');
  results.classList.remove('hidden');
  results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.currentDiagnostic = { ...result, shareText: buildShareText(result) };
}

form.addEventListener('submit', event => {
  event.preventDefault();
  if (!validateStep()) return;
  renderResults(new FormData(form));
});

document.querySelector('#restart').addEventListener('click', () => {
  form.reset();
  currentStep = 0;
  updateStep();
  document.querySelector('#results').classList.add('hidden');
  form.classList.remove('hidden');
  document.querySelector('.diagnostic-intro').classList.remove('hidden');
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

document.querySelector('#print-result').addEventListener('click', () => window.print());

document.querySelector('#share-result').addEventListener('click', async event => {
  const text = window.currentDiagnostic?.shareText || '';
  try {
    if (navigator.share) await navigator.share({ title: 'Meu Raio-X Digital', text, url: location.href });
    else { await navigator.clipboard.writeText(`${text}\n\n${location.href}`); event.currentTarget.textContent = 'Resultado copiado!'; setTimeout(() => event.currentTarget.textContent = 'Compartilhar resultado', 2200); }
  } catch (error) { if (error.name !== 'AbortError') alert('Não foi possível compartilhar agora. Tente salvar em PDF.'); }
});

document.querySelectorAll('details').forEach(detail => detail.addEventListener('toggle', () => {
  if (detail.open) document.querySelectorAll('details[open]').forEach(other => { if (other !== detail) other.open = false; });
}));

const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); } }), { threshold: .12 });
document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
document.querySelector('#year').textContent = new Date().getFullYear();
updateStep();
