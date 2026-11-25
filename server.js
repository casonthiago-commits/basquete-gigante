const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const salas = {};

function criarCodigo() {
  let c;
  do { c = Math.floor(1000 + Math.random() * 9000).toString(); }
  while (salas[c]);
  return c;
}

function enviarAtualizar(codigo) {
  const sala = salas[codigo];
  if (!sala) return;
  io.to(codigo).emit('atualizar', {
    jogadores: sala.jogadores,
    bola: sala.bola,
    placar: sala.placar,
    tempo: sala.tempo
  });
}

io.on('connection', (socket) => {
  console.log('Jogador conectado', socket.id);

  socket.on('criar_sala', (d) => {
    const codigo = criarCodigo();
    salas[codigo] = {
      jogadores: [{ id: socket.id, nome: d.nome, personagem: d.personagem, x: 100, y: 280, time: 'azul' }],
      bola: { x: 400, y: 280 },
      placar: { azul: 0, vermelho: 0 },
      tempo: 60,
      emJogo: false,
      intervalo: null
    };
    socket.join(codigo);
    socket.data.codigo = codigo;
    socket.emit('sala_criada', { codigo });
    enviarAtualizar(codigo);
  });

  socket.on('entrar_sala', (d) => {
    const sala = salas[d.codigo];
    if (!sala) { socket.emit('erro', { msg: 'Sala não encontrada!' }); return; }
    if (sala.jogadores.length >= 4) { socket.emit('erro', { msg: 'Sala cheia!' }); return; }
    if (sala.emJogo) { socket.emit('erro', { msg: 'Jogo já começou!' }); return; }

    const time = sala.jogadores.filter(j => j.time === 'azul').length <= sala.jogadores.filter(j => j.time === 'vermelho').length ? 'azul' : 'vermelho';
    const x = time === 'azul' ? 100 : 700;
    sala.jogadores.push({ id: socket.id, nome: d.nome, personagem: d.personagem, x, y: 280, time });
    socket.join(d.codigo);
    socket.data.codigo = d.codigo;
    socket.emit('sala_criada', { codigo: d.codigo });
    enviarAtualizar(d.codigo);
  });

  socket.on('iniciar_jogo', (d) => {
    const sala = salas[d.codigo];
    if (!sala || sala.emJogo) return;
    sala.emJogo = true;
    sala.placar = { azul: 0, vermelho: 0 };
    sala.tempo = 60;
    sala.bola = { x: 400, y: 280 };
    io.to(d.codigo).emit('iniciar', { jogadores: sala.jogadores, bola: sala.bola, placar: sala.placar, tempo: sala.tempo });

    sala.intervalo = setInterval(() => {
      if (!salas[d.codigo]) return;
      sala.tempo--;
      if (sala.tempo <= 0) {
        clearInterval(sala.intervalo);
        sala.emJogo = false;
        io.to(d.codigo).emit('fim', { placar: sala.placar });
        return;
      }
      enviarAtualizar(d.codigo);
    }, 1000);
  });

  socket.on('mover', (d) => {
    const sala = salas[d.codigo];
    if (!sala) return;
    const j = sala.jogadores.find(p => p.id === socket.id);
    if (!j) return;
    j.x = d.x; j.y = d.y;

    // Bola segue o jogador mais próximo
    const dist = Math.sqrt(Math.pow(j.x - sala.bola.x, 2) + Math.pow(j.y - sala.bola.y, 2));
    if (dist < 35) {
      sala.bola.x = j.x + 25;
      sala.bola.y = j.y;
    }

    // Gol - cesta da esquerda = ponto do Vermelho, direita = ponto do Azul
    if (sala.bola.x <= 45 && sala.bola.y > 200 && sala.bola.y < 360) {
      sala.placar.vermelho++;
      io.to(d.codigo).emit('gol', { jogador: j.nome, placar: sala.placar });
      sala.bola = { x: 400, y: 280 };
    }
    if (sala.bola.x >= 755 && sala.bola.y > 200 && sala.bola.y < 360) {
      sala.placar.azul++;
      io.to(d.codigo).emit('gol', { jogador: j.nome, placar: sala.placar });
      sala.bola = { x: 400, y: 280 };
    }
    enviarAtualizar(d.codigo);
  });

  socket.on('disconnect', () => {
    const codigo = socket.data.codigo;
    if (!codigo || !salas[codigo]) return;
    salas[codigo].jogadores = salas[codigo].jogadores.filter(p => p.id !== socket.id);
    if (salas[codigo].jogadores.length === 0) {
      if (salas[codigo].intervalo) clearInterval(salas[codigo].intervalo);
      delete salas[codigo];
    } else {
      enviarAtualizar(codigo);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Servidor rodando na porta ' + PORT));
