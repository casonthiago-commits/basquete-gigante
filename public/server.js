const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static('public'));
const salas = {};
function criarBola(){ return {x:400, y:280, vx:0, vy:0}; }
io.on('connection', (socket)=>{
  socket.on('criar_sala', ({nome})=>{
    const codigo = Math.random().toString(36).substring(2,6).toUpperCase();
    salas[codigo] = { jogadores:{}, bola:criarBola(), placar:{azul:0, vermelho:0}, tempo:120, jogando:false, intervalo:null };
    socket.emit('sala_criada', {codigo});
  });
  socket.on('entrar_sala', ({nome, codigo, personagem, time})=>{
    const sala = salas[codigo]; if(!sala) return socket.emit('erro','Sala não encontrada!');
    sala.jogadores[socket.id] = { nome, personagem: personagem||'🦊', time: time||'azul', x: time==='vermelho'?700:100, y: 200+Math.random()*160, andando:false };
    socket.join(codigo); socket.codigo=codigo;
    if(!sala.jogando){ sala.jogando=true; sala.intervalo=setInterval(()=>{
      sala.tempo--;
      let b=sala.bola; b.x+=b.vx; b.y+=b.vy; b.vx*=0.96; b.vy*=0.96;
      if(b.y<60||b.y>500){ b.vy*=-1; b.y=Math.max(60,Math.min(500,b.y)); }
      Object.values(sala.jogadores).forEach(j=>{
        let dx=b.x-j.x, dy=b.y-j.y, d=Math.sqrt(dx*dx+dy*dy);
        if(d<85 && d>0){ b.vx+=dx/d*3; b.vy+=dy/d*3; }
      });
      if(b.x<20){ sala.placar.vermelho+=2; sala.bola=criarBola(); io.to(codigo).emit('gol','CESTA DO VERMELHO! 🏀 +2'); }
      if(b.x>780){ sala.placar.azul+=2; sala.bola=criarBola(); io.to(codigo).emit('gol','CESTA DO AZUL! 🏀 +2'); }
      if(sala.tempo<=0){ clearInterval(sala.intervalo); io.to(codigo).emit('fim', sala.placar); }
      io.to(codigo).emit('atualizar',{jogadores:Object.values(sala.jogadores), bola:sala.bola, placar:sala.placar, tempo:sala.tempo});
    }, 1000/60); }
  });
  socket.on('mover', ({codigo, x, y})=>{
    const sala=salas[codigo]; if(!sala||!sala.jogadores[socket.id]) return;
    let j=sala.jogadores[socket.id]; j.andando = Math.abs(j.x-x)>2 || Math.abs(j.y-y)>2; j.x=Math.max(30,Math.min(770,x)); j.y=Math.max(40,Math.min(520,y));
  });
  socket.on('iniciar_jogo', ({codigo})=>{
    const sala=salas[codigo]; if(sala){ sala.placar={azul:0,vermelho:0}; sala.tempo=120; sala.bola=criarBola(); }
  });
  socket.on('disconnect', ()=>{ if(socket.codigo && salas[socket.codigo]) delete salas[socket.codigo].jogadores[socket.id]; });
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>console.log('Rodando na porta '+PORT));
