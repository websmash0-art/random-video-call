const startBtn = document.getElementById('startBtn');
const nextBtn = document.getElementById('nextBtn');
const statusDiv = document.getElementById('status');
const roomInfo = document.getElementById('roomInfo');
const meetNode = document.getElementById('meet');

let ws;
let api = null;
let currentRoom = null;

function setStatus(s) { statusDiv.textContent = s; }

function connectWS() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(proto + '://' + location.host);

  ws.onopen = () => console.log('WebSocket connected');

  ws.onmessage = (ev) => {
    const data = JSON.parse(ev.data);
    if (data.type === 'waiting') {
      setStatus('Waiting for partner...');
      nextBtn.disabled = true;
    } else if (data.type === 'room') {
      setStatus('Matched — joining room');
      currentRoom = data.room;
      nextBtn.disabled = false;
      showRoom(currentRoom);
      startJitsi(currentRoom);
    } else if (data.type === 'partner_left') {
      setStatus('Partner left. Click Next to find another.');
      if (api) { api.dispose(); api = null; }
      meetNode.innerHTML = '';
      currentRoom = null;
      nextBtn.disabled = false;
      roomInfo.innerHTML = '';
    }
  };

  ws.onclose = () => console.log('WebSocket closed');
  ws.onerror = (e) => console.error('WebSocket error', e);
}

function showRoom(room) {
  const link = location.origin + location.pathname + '?room=' + encodeURIComponent(room);
  roomInfo.innerHTML = `Room: <b>${room}</b> — share link: <a href="${link}" target="_blank">${link}</a>`;
}

function startJitsi(room) {
  if (api) { api.dispose(); api = null; meetNode.innerHTML = ''; }
  const domain = 'meet.jit.si';
  const options = {
    roomName: 'RandomCall/' + room,
    parentNode: meetNode,
    width: '100%',
    height: 520,
    interfaceConfigOverwrite: {
      TOOLBAR_BUTTONS: ['microphone','camera','desktop','hangup','chat','tileview']
    }
  };
  api = new JitsiMeetExternalAPI(domain, options);

  api.addEventListener('readyToClose', () => {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'leave' }));
    api.dispose();
    api = null;
    meetNode.innerHTML = '';
    setStatus('Call ended');
  });
}

// Start button
startBtn.onclick = () => {
  connectWS();
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'join' }));
    setStatus('Joining queue...');
  } else {
    setStatus('Connecting to server...');
    const t = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        clearInterval(t);
        ws.send(JSON.stringify({ type: 'join' }));
        setStatus('Joining queue...');
      }
    }, 200);
  }
  startBtn.disabled = true;
};

// Next button
nextBtn.onclick = () => {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'leave' }));
  if (api) { api.dispose(); api = null; }
  meetNode.innerHTML = '';
  roomInfo.innerHTML = '';
  currentRoom = null;
  setStatus('Looking for next partner...');
  setTimeout(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) connectWS();
    setTimeout(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'join' }));
      }
    }, 300);
  }, 200);
};

// Auto-join from URL
(function autoJoinFromURL(){
  const url = new URL(window.location.href);
  const r = url.searchParams.get('room');
  if (r) {
    showRoom(r);
    startJitsi(r);
    startBtn.disabled = true;
    nextBtn.disabled = false;
    setStatus('Joined room from link');
    connectWS();
  } else {
    connectWS();
  }
})();
