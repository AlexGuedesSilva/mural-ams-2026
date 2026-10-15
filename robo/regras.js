// Regras do Mural da Turma.
//
// Este arquivo só tem funções "puras": recebem textos, devolvem uma lista de
// problemas. Ele não acessa internet nem disco, o que deixa fácil de testar.
// Quem usa estas regras: validar-pr.js (o robô dos pull requests),
// validar-tudo.js (conferência local) e montar-site.js (publicação).

const { temPalavraBloqueada } = require('./palavras.js');

const CAMPOS = ['nome', 'emoji', 'frase', 'cor'];

// Lista fechada de cores. O site traduz cada nome para uma cor de verdade.
const CORES = ['vermelho', 'laranja', 'amarelo', 'verde', 'turquesa', 'azul', 'roxo', 'rosa'];

const LIMITE_FRASE = 80;
const LIMITE_NOME = 20;
const LIMITE_ARQUIVO_BYTES = 2000;
const PASTA = 'cartoes/';

// Conta "letras que a gente vê": 🚀 conta 1, "ã" conta 1, 👩‍💻 conta 1.
const segmentador = new Intl.Segmenter('pt-BR', { granularity: 'grapheme' });
function contarCaracteres(texto) {
  return [...segmentador.segment(texto)].length;
}

function ehUmEmoji(texto) {
  const pedacos = [...segmentador.segment(texto)];
  if (pedacos.length !== 1) return false;
  return /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u.test(texto);
}

// Distância de edição: quantas letras precisa trocar para virar a outra palavra.
// Serve para sugerir "Será que você quis dizer emoji?" quando alguém digita "emogi".
function distancia(a, b) {
  const linha = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let anterior = linha[0];
    linha[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const guardado = linha[j];
      linha[j] = Math.min(linha[j] + 1, linha[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
      anterior = guardado;
    }
  }
  return linha[b.length];
}

function sugerirCampo(campoErrado) {
  const semAcento = campoErrado.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  return CAMPOS.find((c) => distancia(semAcento, c) <= 2);
}

// Transforma o erro técnico do JSON.parse numa dica que um iniciante entende.
function explicarJsonQuebrado(texto, erro) {
  const problemas = [];
  const linha = /line (\d+)/.exec(erro.message);
  problemas.push(
    '❌ O arquivo não está no formato JSON certinho' +
      (linha ? `, o problema está perto da **linha ${linha[1]}**.` : '.')
  );
  if (/[“”‘’]/.test(texto)) {
    problemas.push('💡 Dica: achei aspas "curvas" (“ ”). Use as aspas retas do teclado: "');
  } else if (/,\s*}\s*$/.test(texto)) {
    problemas.push('💡 Dica: tem uma vírgula sobrando antes do `}` final. Apague a vírgula da última linha.');
  } else if (/"\s*\n\s*"/.test(texto)) {
    problemas.push('💡 Dica: parece que faltou uma vírgula no fim de alguma linha.');
  } else if (!texto.trim().startsWith('{') || !texto.trim().endsWith('}')) {
    problemas.push('💡 Dica: o cartão precisa começar com `{` e terminar com `}`.');
  } else {
    problemas.push('💡 Dica: confira se cada linha tem `"campo": "valor"` e se há vírgula entre as linhas.');
  }
  return problemas;
}

// Confere um cartão. Recebe o caminho (ex.: "cartoes/ana.json") e o texto do arquivo.
// Devolve { problemas: [...], cartao } — sem problemas = cartão aprovado pelo robô.
function validarCartao(caminho, texto) {
  const problemas = [];
  const nomeArquivo = caminho.slice(PASTA.length);

  if (!caminho.startsWith(PASTA) || !/^[a-z0-9]+(-[a-z0-9]+)*\.json$/.test(nomeArquivo)) {
    problemas.push(
      `❌ O nome do arquivo \`${caminho}\` não vale. Use algo como \`cartoes/ana.json\`: ` +
        'só letras minúsculas sem acento, números ou hífen, terminando em `.json`.'
    );
  }

  if (Buffer.byteLength(texto, 'utf8') > LIMITE_ARQUIVO_BYTES) {
    problemas.push('❌ Esse arquivo está grande demais para um cartão. Ele só precisa de 4 linhas!');
    return { problemas, cartao: null };
  }

  let cartao;
  try {
    cartao = JSON.parse(texto.replace(/^﻿/, ''));
  } catch (erro) {
    problemas.push(...explicarJsonQuebrado(texto, erro));
    return { problemas, cartao: null };
  }

  if (cartao === null || typeof cartao !== 'object' || Array.isArray(cartao)) {
    problemas.push('❌ O cartão precisa ser um bloco entre chaves `{ }` com os campos nome, emoji, frase e cor.');
    return { problemas, cartao: null };
  }

  for (const campo of Object.keys(cartao)) {
    if (CAMPOS.includes(campo)) continue;
    const sugestao = sugerirCampo(campo);
    problemas.push(
      `❌ O campo \`${campo}\` não existe no cartão.` +
        (sugestao ? ` Será que você quis dizer \`${sugestao}\`?` : ` Os campos são: ${CAMPOS.join(', ')}.`)
    );
  }

  const faltou = { nome: 'Faltou o nome!', emoji: 'Faltou o emoji!', frase: 'Faltou a frase!', cor: 'Faltou a cor!' };
  const vazio = { nome: 'O nome está vazio!', emoji: 'O emoji está vazio!', frase: 'A frase está vazia!', cor: 'A cor está vazia!' };
  for (const campo of CAMPOS) {
    if (!(campo in cartao)) {
      problemas.push(`❌ ${faltou[campo]}`);
    } else if (typeof cartao[campo] !== 'string') {
      problemas.push(`❌ O valor de \`${campo}\` precisa estar entre aspas, assim: \`"${campo}": "..."\``);
    } else if (cartao[campo].trim() === '') {
      problemas.push(`❌ ${vazio[campo]}`);
    }
  }

  const valor = (campo) => (typeof cartao[campo] === 'string' ? cartao[campo].trim() : '');
  const nome = valor('nome');
  const emoji = valor('emoji');
  const frase = valor('frase');
  const cor = valor('cor');

  if (nome) {
    if (/\s/.test(nome)) {
      problemas.push('❌ Coloque só o primeiro nome, sem sobrenome (é pela sua segurança 😉).');
    } else if (!/^\p{L}+([-']\p{L}+)*$/u.test(nome)) {
      problemas.push('❌ O nome só pode ter letras (pode ter acento e hífen, tipo `Ana-Clara`).');
    } else if (contarCaracteres(nome) > LIMITE_NOME) {
      problemas.push(`❌ O nome passou de ${LIMITE_NOME} letras. Que tal um apelido?`);
    }
  }

  if (emoji && !ehUmEmoji(emoji)) {
    problemas.push(`❌ O emoji precisa ser 1 emoji só (tipo 🚀). Você colocou: \`${emoji}\``);
  }

  if (frase) {
    const tamanho = contarCaracteres(frase);
    if (tamanho > LIMITE_FRASE) {
      problemas.push(
        `❌ A frase tem ${tamanho} caracteres, mas o limite é ${LIMITE_FRASE}. ` +
          `Corte ${tamanho - LIMITE_FRASE} caractere${tamanho - LIMITE_FRASE > 1 ? 's' : ''}.`
      );
    }
    if (/https?:|www\.|\.com\b|\.br\b/i.test(frase)) {
      problemas.push('❌ Sem links na frase, combinado? Só texto.');
    }
    if (/\d[\d\s().-]{7,}\d/.test(frase) || /\S+@\S+\.\S+/.test(frase)) {
      problemas.push('❌ Não coloque telefone nem e-mail no mural: ele é público!');
    }
  }

  if (cor && !CORES.includes(cor.toLowerCase())) {
    problemas.push(`❌ A cor \`${cor}\` não está na lista. Escolha uma destas: ${CORES.join(', ')}.`);
  }

  if ([nome, frase].some(temPalavraBloqueada)) {
    problemas.push('❌ Opa! Achei uma palavra que não pode ir pro mural. Troca por outra? 🙏');
  }

  const limpo = { nome, emoji, frase, cor: cor.toLowerCase() };
  return { problemas, cartao: problemas.length === 0 ? limpo : null };
}

// Confere a LISTA de arquivos que o pull request mexeu (sem olhar o conteúdo).
// Cada item: { caminho, situacao, caminhoAntigo } — situacao vem da API do GitHub:
// "added" (criado), "modified" (alterado), "removed" (apagado), "renamed" (renomeado)...
function validarMudancas(arquivos) {
  const problemas = [];

  for (const a of arquivos) {
    const caminhos = [a.caminho, a.caminhoAntigo].filter(Boolean);
    const fora = caminhos.find((c) => !c.startsWith(PASTA));
    if (fora) {
      problemas.push(`❌ Você mexeu em \`${fora}\`, mas o robô só aceita mudanças dentro da pasta \`cartoes/\`.`);
    } else if (a.situacao !== 'added') {
      const verbo = { modified: 'alterou', removed: 'apagou', renamed: 'renomeou' }[a.situacao] || 'mexeu em';
      problemas.push(
        `❌ Você ${verbo} \`${a.caminhoAntigo || a.caminho}\`, que já está no mural (pode ser de outra pessoa!). ` +
          'O combinado é só **criar** o seu próprio cartão.'
      );
    }
  }

  const novos = arquivos.filter((a) => a.situacao === 'added' && a.caminho.startsWith(PASTA));
  if (arquivos.length === 0 || (novos.length === 0 && problemas.length === 0)) {
    problemas.push('❌ Não achei nenhum cartão novo neste pull request. Crie o arquivo `cartoes/seu-nome.json`.');
  } else if (novos.length > 1) {
    problemas.push(
      `❌ Este pull request tem ${novos.length} cartões, mas cada pessoa manda só 1. ` +
        `Arquivos: ${novos.map((a) => `\`${a.caminho}\``).join(', ')}.`
    );
  }

  return problemas;
}

module.exports = { CAMPOS, CORES, LIMITE_FRASE, PASTA, validarCartao, validarMudancas, contarCaracteres };
