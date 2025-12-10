const startBtn = document.getElementById("startBtn");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

// Connect to backend WebSocket server
const ws = new WebSocket("wss://" + window.location.host);

let localStream;
let peer;

startBtn.onclick = async () => {
    startBtn.disabled = true;

    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;

    peer = new RTCPeerConnection();
    localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

    peer.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    peer.onicecandidate = (event) => {
        if (event.candidate) {
            ws.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
        }
    };

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    ws.send(JSON.stringify({ type: "offer", offer }));
};

ws.onmessage = async (msg) => {
    const data = JSON.parse(msg.data);

    if (data.type === "offer") {
        peer = new RTCPeerConnection();

        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;

        localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

        peer.ontrack = (event) => {
            remoteVideo.srcObject = event.streams[0];
        };

        peer.onicecandidate = (event) => {
            if (event.candidate) {
                ws.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
            }
        };

        await peer.setRemoteDescription(new RTCSessionDescription(data.offer));

        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        ws.send(JSON.stringify({ type: "answer", answer }));
    }

    if (data.type === "answer") {
        await peer.setRemoteDescription(new RTCSessionDescription(data.answer));
    }

    if (data.type === "candidate") {
        try {
            await peer.addIceCandidate(data.candidate);
        } catch (e) {
            console.warn("ICE add error", e);
        }
    }
};
