/**
 * Padroniza o cabeçalho dos templates de email.
 * Formato padrão (2 linhas):
 *   Subject line: <assunto>
 *   From: <Nome> - <email>
 *   <blank>
 *   <html...>
 * Corrige também o typo "ssupport" -> "support".
 */
const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '..', 'email-templates');
const FROM_PADRAO = 'ZapSpy.Ai - support@mail.appdetect.site';
const SUBJECTS_MANUAIS = {}; // se algum arquivo precisar de subject manual, preencher

function listarArquivos(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listarArquivos(full, acc);
    } else if (entry.name.endsWith('.txt')) {
      acc.push(full);
    }
  }
  return acc;
}

function extrairSubject(relativo, conteudo, semSubject) {
  if (SUBJECTS_MANUAIS[relativo]) return SUBJECTS_MANUAIS[relativo];
  if (semSubject) return semSubject;
  return '';
}

function processar(arquivo) {
  let raw = fs.readFileSync(arquivo, 'utf8');
  const rel = path.relative(TEMPLATES_DIR, arquivo);
  const temSubject = /^Subject line:\s*\S/m.test(raw);

  // Extrai subject se existir (mesma linha ou linha seguinte)
  let subject = '';
  let resto = raw;
  if (temSubject) {
    // Tenta "Subject line: x" na mesma linha
    let m = raw.match(/^Subject line:\s*(.+)$/m);
    if (m) {
      subject = m[1].trim();
    } else {
      // tenta "Subject line:" e valor na linha seguinte
      m = raw.match(/^Subject line:\s*$\r?\n\s*(.+)$/m);
      if (m) subject = m[1].trim();
    }
    // Remove linha(s) do Subject
    resto = resto
      .split(/\r?\n/)
      .filter(l => !/^Subject line:/.test(l) && l.trim() !== '')
      .join('\n');
  }

  // Extrai From se houver
  let temFrom = /^From:\s*\S/m.test(resto);
  if (temFrom) {
    resto = resto
      .split(/\r?\n/)
      .filter(l => !/^From:/.test(l) && l.trim() !== '')
      .join('\n');
  }

  // Extrai Preheader se houver (linha avulsa "Preheader:")
  if (/^Preheader:\s*$/m.test(resto)) {
    resto = resto.split(/\r?\n/).filter(l => l.trim() !== 'Preheader:').join('\n');
  }

  const html = resto.trimStart();
  const cabecalho = [
    `Subject line: ${subject.trim()}`,
    `From: ${FROM_PADRAO}`,
    '',
    html,
  ].join('\n');

  fs.writeFileSync(arquivo, cabecalho + '\n', 'utf8');
  console.log(`✔ ${rel}${temSubject ? '' : '  (SEM subject — use SUBJECTS_MANUAIS)'}`);
}

try {
  const arquivos = listarArquivos(TEMPLATES_DIR);
  for (const a of arquivos) processar(a);
  console.log(`\n${arquivos.length} arquivos processados.`);
} catch (e) {
  console.error('ERRO:', e.message);
  process.exit(1);
}
