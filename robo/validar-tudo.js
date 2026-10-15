// Confere todos os cartões da pasta cartoes/ (ou os arquivos passados na linha de comando).
// Uso, dentro da pasta mural/:
//   node robo/validar-tudo.js                     -> confere a pasta cartoes/ inteira
//   node robo/validar-tudo.js teste/ana.json ...  -> confere só esses arquivos

const fs = require('node:fs');
const path = require('node:path');
const { validarCartao, PASTA } = require('./regras.js');

const raiz = path.join(__dirname, '..');

function lerCartoes(arquivos) {
  if (arquivos.length === 0) {
    const pasta = path.join(raiz, PASTA);
    arquivos = fs
      .readdirSync(pasta)
      .filter((a) => !a.startsWith('.'))
      .map((a) => path.join(pasta, a));
  }
  return arquivos.map((arquivo) => {
    // As regras esperam o caminho "cartoes/<nome>", então usamos só o nome do arquivo.
    const caminho = PASTA + path.basename(arquivo);
    return { caminho, ...validarCartao(caminho, fs.readFileSync(arquivo, 'utf8')) };
  });
}

if (require.main === module) {
  const resultados = lerCartoes(process.argv.slice(2));
  for (const { caminho, problemas } of resultados) {
    if (problemas.length === 0) console.log(`✅ ${caminho}`);
    else console.log(`\n${caminho}\n${problemas.map((p) => `   ${p}`).join('\n')}\n`);
  }
  const ruins = resultados.filter((r) => r.problemas.length > 0).length;
  console.log(`\n${resultados.length - ruins} cartão(ões) ok, ${ruins} com problema.`);
  process.exitCode = ruins === 0 ? 0 : 1;
}

module.exports = { lerCartoes };
