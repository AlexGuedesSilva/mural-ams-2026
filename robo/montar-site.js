// Monta o site na pasta _site/: copia site/ e junta todos os cartões num arquivo só,
// _site/cartoes.json, que a página lê. Roda no workflow de publicação e também no seu
// computador, para ensaiar (veja robo/servir.js).
//
// Um cartão com problema NÃO derruba o site: ele só fica de fora, com um aviso no log.

const fs = require('node:fs');
const path = require('node:path');
const { lerCartoes } = require('./validar-tudo.js');

const raiz = path.join(__dirname, '..');
const saida = path.join(raiz, '_site');

fs.rmSync(saida, { recursive: true, force: true });
fs.cpSync(path.join(raiz, 'site'), saida, { recursive: true });

const cartoes = [];
for (const { caminho, problemas, cartao } of lerCartoes([])) {
  if (cartao) cartoes.push({ arquivo: path.basename(caminho, '.json'), ...cartao });
  else console.warn(`⚠️ ${caminho} ficou de fora do mural:\n   ${problemas.join('\n   ')}`);
}
cartoes.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

fs.writeFileSync(path.join(saida, 'cartoes.json'), JSON.stringify(cartoes, null, 2));
console.log(`🧱 Site montado em _site/ com ${cartoes.length} cartões.`);
