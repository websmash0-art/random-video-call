const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));

// Simple matchmaking: keep one waiting client
let waiting = null;

wss.on('connection', (ws) => {
  ws.id = uuidv4();
  console.log('Client connected', ws.id);

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === 'join') {
        // If someone is waiting, pair them
        if (waiting && waiting !== ws && waiting.readyState === WebSocket.OPEN) {
          const room = 'random_' + uuidv4().split('-')[0];
          ws.partner = waiting;
          waiting.partner = ws;

          ws.send(JSON.stringify({ type: 'room', room }));
          waiting.send(JSON.stringify({ type: 'room', room }));

          waiting = null;
          console.log('Paired', ws.id, ws.partner.id, 'room', room);
        } else {
          // Put this client in waiting slot
          waiting = ws;
          ws.send(JSON.stringify({ type: 'waiting' }));
          console.log('Client waiting', ws.id);
        }
      } else if (data.type === 'leave') {
        if (ws.partner && ws.partner.readyState === WebSocket.OPEN) {
          ws.partner.send(JSON.stringify({ type: 'partner_left' }));
          ws.partner.partner = null;
        }
        if (waiting === ws) waiting = null;
      }
    } catch (e) {
      console.error('Invalid message', e);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected', ws.id);
    if (ws.partner && ws.partner.readyState === WebSocket.OPEN) {
      ws.partner.send(JSON.stringify({ type: 'partner_left' }));
      ws.partner.partner = null;
    }
    if (waiting === ws) waiting = null;
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
