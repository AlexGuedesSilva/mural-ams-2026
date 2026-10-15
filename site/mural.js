// Mural da Turma: busca cartoes.json, desenha os cartões e, a cada 15 segundos,
// confere se chegaram cartões novos (depois de cada merge, o site é publicado de novo).
//
// Modo TV: abra o endereço com ?tv no final. Tudo cabe na tela sem rolar e cada
// cartão novo aparece em destaque por alguns segundos.

const INTERVALO_MS = 15000;
const DESTAQUE_MS = 5000; // quando chegam muitos de uma vez, cada um fica menos tempo

const modoTV = new URLSearchParams(location.search).has('tv');
const mural = document.getElementById('mural');
const modelo = document.getElementById('modelo-cartao');
const destaque = document.getElementById('destaque');
const conhecidos = new Set();
const filaDestaque = [];
let primeiraVez = true;

if (modoTV) document.body.classList.add('tv');

function criarCartao(c) {
  const cartao = modelo.content.firstElementChild.cloneNode(true);
  cartao.classList.add(`cor-${c.cor}`);
  // Uma inclinação pequena e fixa por pessoa, para parecer papel colado na parede.
  const giro = ([...c.arquivo].reduce((soma, letra) => soma + letra.charCodeAt(0), 0) % 5) - 2;
  cartao.style.setProperty('--giro', `${giro * 0.6}deg`);
  // textContent (e não innerHTML): o texto do aluno nunca vira código na página.
  cartao.querySelector('.emoji').textContent = c.emoji;
  cartao.querySelector('.nome').textContent = c.nome;
  cartao.querySelector('.frase').textContent = c.frase;
  return cartao;
}

function desenhar(cartoes) {
  const novos = cartoes.filter((c) => !conhecidos.has(c.arquivo));
  mural.replaceChildren(
    ...cartoes.map((c) => {
      const el = criarCartao(c);
      if (!primeiraVez && novos.includes(c)) el.classList.add('novo');
      return el;
    })
  );
  novos.forEach((c) => conhecidos.add(c.arquivo));
  document.getElementById('total').textContent = cartoes.length;
  document.getElementById('vazio').hidden = cartoes.length > 0;
  if (modoTV) encaixarNaTela();
  if (modoTV && !primeiraVez) {
    filaDestaque.push(...novos);
    mostrarProximoDestaque();
  }
  primeiraVez = false;
}

// Escolhe o número de colunas que deixa os cartões o maior possível sem rolar a tela.
function encaixarNaTela() {
  const n = mural.children.length;
  if (n === 0) return;
  const { width: largura, height: altura } = mural.getBoundingClientRect();
  const espaco = parseFloat(getComputedStyle(mural).rowGap) || 16;
  const proporcao = 5 / 4;
  let melhor = { colunas: 1, tamanho: 0 };
  for (let colunas = 1; colunas <= n; colunas++) {
    const linhas = Math.ceil(n / colunas);
    const porLargura = (largura - espaco * (colunas - 1)) / colunas;
    const porAltura = ((altura - espaco * (linhas - 1)) / linhas) * proporcao;
    const tamanho = Math.min(porLargura, porAltura);
    if (tamanho > melhor.tamanho) melhor = { colunas, tamanho };
  }
  mural.style.setProperty('--colunas', melhor.colunas);
  mural.style.setProperty('--linhas', Math.ceil(n / melhor.colunas));
}

function mostrarProximoDestaque() {
  if (!destaque.hidden || filaDestaque.length === 0) return;
  const c = filaDestaque.shift();
  document.getElementById('destaque-cartao').replaceChildren(criarCartao(c));
  destaque.hidden = false;
  setTimeout(() => {
    destaque.hidden = true;
    mostrarProximoDestaque();
  }, filaDestaque.length >= 3 ? DESTAQUE_MS / 2 : DESTAQUE_MS);
}

async function atualizar() {
  try {
    // ?t=... evita que o navegador (ou o GitHub Pages) entregue uma cópia velha.
    const resposta = await fetch(`cartoes.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const cartoes = await resposta.json();
    const mudou = cartoes.length !== conhecidos.size || cartoes.some((c) => !conhecidos.has(c.arquivo));
    if (mudou || primeiraVez) desenhar(cartoes);
  } catch (erro) {
    console.warn('Não consegui buscar os cartões agora, tento de novo daqui a pouco.', erro);
  }
}

window.addEventListener('resize', () => modoTV && encaixarNaTela());
atualizar();
setInterval(atualizar, INTERVALO_MS);
