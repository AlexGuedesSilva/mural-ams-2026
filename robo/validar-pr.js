// O robô do pull request.
//
// Roda dentro do GitHub Actions (workflow .github/workflows/robo.yml).
// SEGURANÇA: este script sempre vem da branch main. Ele NUNCA baixa nem executa
// código do pull request: só pede à API do GitHub a lista de arquivos e o TEXTO
// do cartão, e confere esse texto com JSON.parse (que só lê dados, não executa nada).
//
// Variáveis de ambiente que o workflow entrega:
//   GITHUB_TOKEN  chave temporária do robô (só pode ler o repo e comentar no PR)
//   REPO          ex.: Medinagui/mural-ams-2026
//   PR_NUMERO     número do pull request

const fs = require('node:fs');
const { validarCartao, validarMudancas } = require('./regras.js');

const MARCA = '<!-- robo-do-mural -->';

// A decisão do robô, separada da conversa com o GitHub para poder ser testada.
// lerConteudo(caminho) devolve o texto do arquivo no PR.
// existeNaMain(caminho) diz se a main já tem um arquivo com esse nome.
async function analisarPR({ arquivos, lerConteudo, existeNaMain }) {
  const problemas = validarMudancas(arquivos);
  if (problemas.length > 0) return { problemas, cartao: null };

  const { caminho } = arquivos[0];
  if (await existeNaMain(caminho)) {
    return {
      problemas: [
        `❌ Já existe um cartão chamado \`${caminho}\` no mural. ` +
          'Troque o nome do arquivo, por exemplo `cartoes/ana-2.json` ou `cartoes/ana-s.json`.',
      ],
      cartao: null,
    };
  }

  return validarCartao(caminho, await lerConteudo(caminho));
}

function escreverComentario({ problemas, cartao }) {
  if (cartao) {
    const limpar = (t) => t.replace(/[<>*_`[\]\\|#]/g, '');
    return [
      MARCA,
      `## ✅ Tudo certo, ${limpar(cartao.nome)}!`,
      '',
      'Sou o robô do mural 🤖 e conferi o seu cartão. Ele ficou assim:',
      '',
      `> ${cartao.emoji} **${limpar(cartao.nome)}** · cor ${cartao.cor}`,
      `> ${limpar(cartao.frase)}`,
      '',
      'Agora é só esperar o professor aprovar. Quando ele fizer o merge, seu cartão aparece no mural! 🎉',
    ].join('\n');
  }
  return [
    MARCA,
    `## 🔧 Quase lá! Achei ${problemas.length === 1 ? '1 coisinha' : `${problemas.length} coisinhas`} para arrumar`,
    '',
    'Sou o robô do mural 🤖. Antes do cartão ir para o mural, eu confiro se está tudo certo:',
    '',
    ...problemas.map((p) => (p.startsWith('💡') ? `  ${p}` : `- ${p}`)),
    '',
    '**Como consertar:** clique na aba **Files changed** aqui em cima, depois nos **três pontinhos (⋯)** do arquivo ' +
      'e em **Edit file**. Arrume, clique em **Commit changes** e pronto: eu confiro de novo sozinho!',
  ].join('\n');
}

async function principal() {
  const { GITHUB_TOKEN, REPO, PR_NUMERO, GITHUB_STEP_SUMMARY } = process.env;
  const api = process.env.GITHUB_API_URL || 'https://api.github.com';
  if (!GITHUB_TOKEN || !REPO || !PR_NUMERO) {
    console.error('Faltam variáveis GITHUB_TOKEN, REPO ou PR_NUMERO. Este script roda no GitHub Actions.');
    process.exit(2);
  }

  async function github(caminho, opcoes = {}) {
    const resposta = await fetch(`${api}${caminho}`, {
      ...opcoes,
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...opcoes.headers,
      },
    });
    if (resposta.status === 404) return null;
    if (!resposta.ok) throw new Error(`GitHub respondeu ${resposta.status} em ${caminho}: ${await resposta.text()}`);
    return opcoes.texto ? resposta.text() : resposta.json();
  }

  const pr = await github(`/repos/${REPO}/pulls/${PR_NUMERO}`);
  const lista = (await github(`/repos/${REPO}/pulls/${PR_NUMERO}/files?per_page=100`)) || [];
  const arquivos = lista.map((a) => ({
    caminho: a.filename,
    situacao: a.status,
    caminhoAntigo: a.previous_filename,
  }));
  const origem = pr.head.repo ? pr.head.repo.full_name : null;
  const base = pr.base.ref;
  const uri = (c) => c.split('/').map(encodeURIComponent).join('/');

  const resultado = await analisarPR({
    arquivos,
    existeNaMain: async (c) => (await github(`/repos/${REPO}/contents/${uri(c)}?ref=${base}`)) !== null,
    lerConteudo: async (c) => {
      if (!origem) throw new Error('O fork deste pull request foi apagado.');
      const texto = await github(`/repos/${origem}/contents/${uri(c)}?ref=${pr.head.sha}`, {
        headers: { Accept: 'application/vnd.github.raw+json' },
        texto: true,
      });
      return texto ?? '';
    },
  });

  const comentario = escreverComentario(resultado);
  console.log(comentario.replace(MARCA, '').trim());
  if (GITHUB_STEP_SUMMARY) fs.appendFileSync(GITHUB_STEP_SUMMARY, comentario + '\n');

  // Comenta no PR. Se já existe um comentário do robô, atualiza o mesmo (não fica spam).
  try {
    const comentarios = await github(`/repos/${REPO}/issues/${PR_NUMERO}/comments?per_page=100`);
    const meu = comentarios.find((c) => c.user.type === 'Bot' && c.body.includes(MARCA));
    const corpo = JSON.stringify({ body: comentario });
    if (meu) await github(`/repos/${REPO}/issues/comments/${meu.id}`, { method: 'PATCH', body: corpo });
    else await github(`/repos/${REPO}/issues/${PR_NUMERO}/comments`, { method: 'POST', body: corpo });
  } catch (erro) {
    console.warn(`⚠️ Não consegui comentar no PR (o resultado ✅/❌ continua valendo): ${erro.message}`);
  }

  process.exitCode = resultado.problemas.length === 0 ? 0 : 1;
}

if (require.main === module) {
  principal().catch((erro) => {
    console.error('💥 O robô tropeçou:', erro);
    process.exit(1);
  });
}

module.exports = { analisarPR, escreverComentario };
