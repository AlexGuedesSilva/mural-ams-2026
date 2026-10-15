// Filtro simples de palavrões.
//
// A lista fica em palavras-bloqueadas.b64, codificada em base64 só para não
// aparecer em texto puro para quem estiver navegando no repositório.
// Para ver ou mudar a lista (no terminal, dentro da pasta mural/):
//   node robo/palavras.js mostrar
//   node robo/palavras.js adicionar <palavra>
//
// É um filtro SIMPLES: pega a palavra inteira, ignorando acentos, maiúsculas,
// letras repetidas ("porraaa"), números no lugar de letras ("m3rd4") e letras
// separadas ("p.o.r.r.a"). Não pega tudo — a revisão humana no PR continua valendo.

const fs = require('node:fs');
const path = require('node:path');

const ARQUIVO = path.join(__dirname, 'palavras-bloqueadas.b64');

function lerLista() {
  return Buffer.from(fs.readFileSync(ARQUIVO, 'utf8'), 'base64')
    .toString('utf8')
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean);
}

const TROCAS = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' };

// "M3rdaaa!" -> "merda" ; "p.o.r.r.a" -> "p o r r a"
function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[013457@$]/g, (c) => TROCAS[c])
    .replace(/[^a-z]+/g, ' ')
    .trim();
}

// Junta letras repetidas: "porraaa" e "porra" viram "pora". Comparamos sempre assim.
const encolher = (palavra) => palavra.replace(/(.)\1+/g, '$1');

const bloqueadas = new Set(lerLista().map((p) => encolher(normalizar(p))));

function temPalavraBloqueada(texto) {
  if (!texto) return false;
  const palavras = normalizar(texto).split(' ').filter(Boolean);

  // Junta sequências de letras soltas: "p o r r a" vira "porra".
  const candidatas = [...palavras];
  let soltas = '';
  for (const p of [...palavras, '']) {
    if (p.length === 1) {
      soltas += p;
    } else {
      if (soltas.length > 1) candidatas.push(soltas);
      soltas = '';
    }
  }

  return candidatas.some((p) => bloqueadas.has(encolher(p)));
}

if (require.main === module) {
  const [comando, palavra] = process.argv.slice(2);
  if (comando === 'mostrar') {
    console.log(lerLista().join('\n'));
  } else if (comando === 'adicionar' && palavra) {
    const lista = [...new Set([...lerLista(), palavra.toLowerCase()])];
    const b64 = Buffer.from(lista.join('\n') + '\n').toString('base64').replace(/.{76}/g, '$&\n');
    fs.writeFileSync(ARQUIVO, b64.endsWith('\n') ? b64 : b64 + '\n');
    console.log(`✅ "${palavra}" adicionada. A lista tem ${lista.length} palavras.`);
  } else {
    console.log('Uso: node robo/palavras.js mostrar | adicionar <palavra>');
  }
}

module.exports = { temPalavraBloqueada };
