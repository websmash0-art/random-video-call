const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));

let waiting = null; // waiting user

wss.on('connection', (ws) => {
  ws.id = uuidv4();

  ws.on('message', (msg) => {
    let data;
    try { data = JSON.parse(msg); } catch(e){ return; }

    if(data.type === 'join'){
      if(waiting && waiting !== ws && waiting.readyState === WebSocket.OPEN){
        const room = uuidv4().split('-')[0];
        ws.partner = waiting;
        waiting.partner = ws;
        ws.send(JSON.stringify({ type:'partner_found', room }));
        waiting.send(JSON.stringify({ type:'partner_found', room }));
        waiting = null;
      } else {
        waiting = ws;
        ws.send(JSON.stringify({ type:'waiting' }));
      }
    }

    if(data.type === 'signal'){
      if(ws.partner && ws.partner.readyState === WebSocket.OPEN){
        ws.partner.send(JSON.stringify({ type:'signal', signal: data.signal }));
      }
    }

    if(data.type === 'leave'){
      if(ws.partner && ws.partner.readyState === WebSocket.OPEN){
        ws.partner.send(JSON.stringify({ type:'partner_left' }));
        ws.partner.partner = null;
      }
      if(waiting === ws) waiting = null;
      ws.partner = null;
    }
  });

  ws.on('close', ()=>{
    if(ws.partner && ws.partner.readyState === WebSocket.OPEN){
      ws.partner.send(JSON.stringify({ type:'partner_left' }));
      ws.partner.partner = null;
    }
    if(waiting === ws) waiting = null;
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>console.log('Server running on http://localhost:'+PORT));
