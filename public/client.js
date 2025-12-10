const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const nextBtn = document.getElementById('nextBtn');

let pc = null;
let ws = null;
let localStream = null;

// Initialize local camera + mic
async function initLocalStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
    } catch (err) {
        alert("Please allow camera and microphone.");
        console.error(err);
    }
}

// Connect to WebSocket
function connectWS() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(proto + '://' + location.host);

    ws.onopen = () => {
        console.log("WebSocket connected");
        ws.send(JSON.stringify({ type: "join" }));
    };

    ws.onmessage = async (msg) => {
        const data = JSON.parse(msg.data);

        if (data.type === "offer") {
            await createPeerConnection();
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: "answer", answer }));
        } else if (data.type === "answer") {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        } else if (data.type === "candidate") {
            try {
                await pc.addIceCandidate(data.candidate);
            } catch (err) {
                console.error("Error adding ICE candidate:", err);
            }
        } else if (data.type === "next") {
            resetCall();
        }
    };

    ws.onclose = () => {
        console.log("WebSocket closed, reconnecting...");
        setTimeout(connectWS, 1000); // Auto reconnect
    };
}

// Create RTCPeerConnection with STUN + TURN
async function createPeerConnection() {
    if (pc) return;

    pc = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'turn:numb.viagenie.ca', username: 'webrtc@live.com', credential: 'muazkh' }
        ]
    });

    // Add local tracks
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    // Remote stream
    pc.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
        remoteVideo.autoplay = true;
        remoteVideo.playsInline = true;
    };

    // ICE candidates
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            ws.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
        }
    };
}

// Start new call
async function startCall() {
    await initLocalStream();
    connectWS();
}

// Next button
nextBtn.addEventListener('click', () => {
    if (ws) ws.send(JSON.stringify({ type: "next" }));
    resetCall();
});

// Reset peer connection and remote video
function resetCall() {
    if (pc) {
        pc.close();
        pc = null;
    }
    remoteVideo.srcObject = null;
    startCall();
}

// Start automatically on page load
startCall();
