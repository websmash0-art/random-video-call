const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const nextBtn = document.getElementById('nextBtn');
const statusDiv = document.getElementById('status');

let ws, pc, localStream;

async function init(){
  localStream = await navigator.mediaDevices.getUserMedia({ video:true, audio:true });
  localVideo.srcObject = localStream;
  connectWS(); // auto connect
}

function connectWS(){
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(proto + '://' + location.host);

  ws.onopen = () => ws.send(JSON.stringify({ type:'join' }));

  ws.onmessage = async (ev)=>{
    const data = JSON.parse(ev.data);

    if(data.type==='waiting'){
      statusDiv.textContent = 'Waiting for partner...';
    }

    if(data.type==='partner_found'){
      statusDiv.textContent = 'Partner found!';
      startPeerConnection();
    }

    if(data.type==='signal'){
      if(data.signal.sdp){
        await pc.setRemoteDescription(new RTCSessionDescription(data.signal.sdp));
        if(data.signal.sdp.type==='offer'){
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ type:'signal', signal:{ sdp: pc.localDescription } }));
        }
      } else if(data.signal.candidate){
        await pc.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
      }
    }

    if(data.type==='partner_left'){
      statusDiv.textContent = 'Partner left. Auto-matching...';
      cleanup();
      ws.send(JSON.stringify({ type:'join' }));
    }
  };
}

function startPeerConnection(){
  pc = new RTCPeerConnection({ iceServers:[{ urls:'stun:stun.l.google.com:19302' }] });
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  pc.ontrack = e => remoteVideo.srcObject = e.streams[0];
  pc.onicecandidate = e => { if(e.candidate) ws.send(JSON.stringify({ type:'signal', signal:{ candidate:e.candidate } })) };
  createOffer();
}

async function createOffer(){
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  ws.send(JSON.stringify({ type:'signal', signal:{ sdp: pc.localDescription } }));
}

function cleanup(){
  if(pc){ pc.close(); pc=null; }
  remoteVideo.srcObject = null;
}

nextBtn.onclick = ()=>{
  ws.send(JSON.stringify({ type:'leave' }));
  cleanup();
  ws.send(JSON.stringify({ type:'join' }));
  statusDiv.textContent = 'Looking for new partner...';
}

init();
