// Testes do robô. Rode, dentro da pasta mural/:   node --test robo/regras.test.js
// Cada teste imita um erro que um aluno pode cometer e confere a mensagem do robô.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validarCartao, validarMudancas } = require('./regras.js');
const { temPalavraBloqueada } = require('./palavras.js');
const { analisarPR, escreverComentario } = require('./validar-pr.js');

const bom = { nome: 'Ana', emoji: '🎮', frase: 'Com tecnologia eu quero criar jogos', cor: 'rosa' };
const json = (obj) => JSON.stringify(obj, null, 2);
const conferir = (obj, caminho = 'cartoes/ana.json') =>
  validarCartao(caminho, typeof obj === 'string' ? obj : json(obj)).problemas;
const temMensagem = (problemas, trecho) =>
  assert.ok(problemas.some((p) => p.includes(trecho)), `esperava "${trecho}" em:\n${problemas.join('\n')}`);

test('cartão certinho passa', () => {
  assert.deepEqual(conferir(bom), []);
});

test('aceita emojis compostos, bandeira, acento e hífen no nome', () => {
  assert.deepEqual(conferir({ ...bom, emoji: '👩🏽‍💻' }), []);
  assert.deepEqual(conferir({ ...bom, emoji: '🇧🇷' }), []);
  assert.deepEqual(conferir({ ...bom, emoji: '❤️' }), []);
  assert.deepEqual(conferir({ ...bom, nome: 'Ana-Clara' }), []);
  assert.deepEqual(conferir({ ...bom, nome: 'Júlia' }), []);
  assert.deepEqual(conferir({ ...bom, cor: 'Rosa' }), []);
});

test('frase com exatamente 80 caracteres passa; 81 não', () => {
  assert.deepEqual(conferir({ ...bom, frase: 'a'.repeat(80) }), []);
  temMensagem(conferir({ ...bom, frase: 'a'.repeat(81) }), 'Corte 1 caractere.');
  temMensagem(conferir({ ...bom, frase: 'a'.repeat(95) }), 'A frase tem 95 caracteres');
});

test('emoji conta como 1 caractere na frase', () => {
  assert.deepEqual(conferir({ ...bom, frase: '🚀'.repeat(80) }), []);
});

test('campo faltando', () => {
  const { emoji, ...semEmoji } = bom;
  temMensagem(conferir(semEmoji), 'Faltou o emoji!');
  temMensagem(conferir({}), 'Faltou o nome!');
  temMensagem(conferir({}), 'Faltou a cor!');
});

test('campo vazio ou sem aspas', () => {
  temMensagem(conferir({ ...bom, frase: '   ' }), 'A frase está vazia!');
  temMensagem(conferir({ ...bom, nome: 42 }), 'precisa estar entre aspas');
});

test('campo com nome errado sugere o certo', () => {
  const { emoji, ...resto } = bom;
  temMensagem(conferir({ ...resto, emogi: '🎮' }), 'Será que você quis dizer `emoji`?');
  temMensagem(conferir({ ...bom, idade: '15' }), 'não existe no cartão');
});

test('emoji inválido', () => {
  temMensagem(conferir({ ...bom, emoji: '🎮🎮' }), '1 emoji só');
  temMensagem(conferir({ ...bom, emoji: ':)' }), '1 emoji só');
  temMensagem(conferir({ ...bom, emoji: 'a' }), '1 emoji só');
});

test('nome com sobrenome, número ou comprido', () => {
  temMensagem(conferir({ ...bom, nome: 'Ana Souza' }), 'sem sobrenome');
  temMensagem(conferir({ ...bom, nome: 'Ana123' }), 'só pode ter letras');
  temMensagem(conferir({ ...bom, nome: 'A'.repeat(21) }), 'passou de 20 letras');
});

test('cor fora da lista', () => {
  temMensagem(conferir({ ...bom, cor: 'marrom' }), 'A cor `marrom` não está na lista');
  temMensagem(conferir({ ...bom, cor: '#ff0000' }), 'não está na lista');
});

test('sem links, telefone ou e-mail', () => {
  temMensagem(conferir({ ...bom, frase: 'meu canal https://youtube.com/x' }), 'Sem links');
  temMensagem(conferir({ ...bom, frase: 'segue lá www.site.com' }), 'Sem links');
  temMensagem(conferir({ ...bom, frase: 'me chama 11 98765-4321' }), 'telefone');
  temMensagem(conferir({ ...bom, frase: 'ana@gmail.com' }), 'telefone nem e-mail');
  assert.deepEqual(conferir({ ...bom, frase: 'Em 2026 eu quero criar 3 apps' }), []);
});

test('JSON quebrado ganha dica amigável', () => {
  temMensagem(conferir('{ "nome": "Ana", "emoji": "🎮", }'), 'vírgula sobrando');
  temMensagem(conferir('{ “nome”: “Ana” }'), 'aspas "curvas"');
  temMensagem(conferir('{\n "nome": "Ana"\n "emoji": "🎮"\n}'), 'faltou uma vírgula');
  temMensagem(conferir('{\n "nome": "Ana"\n "emoji": "🎮"\n}'), 'linha 3');
  temMensagem(conferir('nome: Ana'), 'começar com `{`');
  temMensagem(conferir('[1, 2]'), 'bloco entre chaves');
  temMensagem(conferir(''), 'formato JSON');
});

test('nome do arquivo', () => {
  temMensagem(conferir(bom, 'cartoes/Ana.json'), 'não vale');
  temMensagem(conferir(bom, 'cartoes/ana souza.json'), 'não vale');
  temMensagem(conferir(bom, 'cartoes/ana.txt'), 'não vale');
  temMensagem(conferir(bom, 'cartoes/joão.json'), 'não vale');
  assert.deepEqual(conferir(bom, 'cartoes/ana-2.json'), []);
});

test('arquivo gigante é recusado', () => {
  temMensagem(conferir({ ...bom, lixo: 'x'.repeat(3000) }), 'grande demais');
});

test('filtro de palavrões pega disfarces e não pega palavras inocentes', () => {
  assert.ok(temPalavraBloqueada('que porra é essa'));
  assert.ok(temPalavraBloqueada('PORRAAAA'));
  assert.ok(temPalavraBloqueada('m3rd4'));
  assert.ok(temPalavraBloqueada('p.o.r.r.a'));
  assert.ok(temPalavraBloqueada('Caralho!'));
  assert.ok(!temPalavraBloqueada('Com tecnologia eu quero criar computadores'));
  assert.ok(!temPalavraBloqueada('quero ser cientista e disputar campeonatos'));
  assert.ok(!temPalavraBloqueada('a e i o u'));
  temMensagem(conferir({ ...bom, frase: 'quero criar uma merda' }), 'palavra que não pode');
  temMensagem(conferir({ ...bom, nome: 'Bosta' }), 'palavra que não pode');
});

test('PR só pode criar 1 arquivo dentro de cartoes/', () => {
  const criar = (caminho) => ({ caminho, situacao: 'added' });
  assert.deepEqual(validarMudancas([criar('cartoes/ana.json')]), []);
  temMensagem(validarMudancas([criar('README.md')]), 'só aceita mudanças dentro da pasta `cartoes/`');
  temMensagem(validarMudancas([criar('cartoes/ana.json'), criar('.github/workflows/robo.yml')]), '.github/workflows/robo.yml');
  temMensagem(validarMudancas([criar('cartoes/ana.json'), criar('cartoes/bia.json')]), '2 cartões');
  temMensagem(validarMudancas([{ caminho: 'cartoes/guilherme.json', situacao: 'modified' }]), 'Você alterou');
  temMensagem(validarMudancas([{ caminho: 'cartoes/guilherme.json', situacao: 'removed' }]), 'Você apagou');
  temMensagem(
    validarMudancas([{ caminho: 'cartoes/ana.json', caminhoAntigo: 'site/index.html', situacao: 'renamed' }]),
    'site/index.html'
  );
  temMensagem(validarMudancas([]), 'Não achei nenhum cartão novo');
});

test('analisarPR: fluxo completo com arquivo de mentira', async () => {
  const pr = (texto, { jaExiste = false, arquivos = [{ caminho: 'cartoes/ana.json', situacao: 'added' }] } = {}) =>
    analisarPR({ arquivos, lerConteudo: async () => texto, existeNaMain: async () => jaExiste });

  const certo = await pr(json(bom));
  assert.deepEqual(certo.problemas, []);
  assert.equal(certo.cartao.nome, 'Ana');
  assert.match(escreverComentario(certo), /✅ Tudo certo, Ana!/);

  const errado = await pr(json({ ...bom, cor: 'marrom' }));
  assert.match(escreverComentario(errado), /1 coisinha/);
  assert.match(escreverComentario(errado), /Edit file/);

  // A dica 💡 não conta como problema.
  const virgula = await pr('{ "nome": "Ana", "emoji": "🎮", "frase": "x", "cor": "rosa", }');
  assert.match(escreverComentario(virgula), /1 coisinha/);

  // Mexeu fora de cartoes/: a orientação é fechar e recomeçar.
  const fora = await pr(json(bom), { arquivos: [{ caminho: 'README.md', situacao: 'modified' }] });
  assert.match(escreverComentario(fora), /Close pull request/);

  temMensagem((await pr(json(bom), { jaExiste: true })).problemas, 'Já existe um cartão');
  temMensagem((await pr(json(bom), { arquivos: [{ caminho: 'site/mural.js', situacao: 'modified' }] })).problemas, 'site/mural.js');
});
