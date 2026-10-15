// Servidor bem simples para ver o mural no seu computador, sem instalar nada.
// Uso, dentro da pasta mural/:
//   node robo/montar-site.js && node robo/servir.js
// e abra http://localhost:8080 (ou http://localhost:8080/?tv para o modo TV).

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const pasta = path.join(__dirname, '..', '_site');
const porta = Number(process.env.PORTA) || 8080;
const tipos = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };

http
  .createServer((pedido, resposta) => {
    const url = decodeURIComponent(new URL(pedido.url, 'http://x').pathname);
    const arquivo = path.join(pasta, url.endsWith('/') ? url + 'index.html' : url);
    if (!arquivo.startsWith(pasta) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
      resposta.writeHead(404).end('Não achei');
      return;
    }
    resposta.writeHead(200, { 'Content-Type': (tipos[path.extname(arquivo)] || 'text/plain') + '; charset=utf-8' });
    fs.createReadStream(arquivo).pipe(resposta);
  })
  .listen(porta, () => console.log(`🖥️  Mural em http://localhost:${porta}  (modo TV: http://localhost:${porta}/?tv)`));
