const socket = io();

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");
const call = document.getElementById("call");
const otherVideos = document.getElementById("otherVideos");


call.hidden = true;

let myStream;
let muted = false;
let cameraOff = false;
let roomName;

let mySocketId;
let myPeerConnections = {};
let otherVideoViews = {};
let myDataChannel;



async function getCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === "videoinput");
    const currentCamera = myStream.getVideoTracks()[0];
    cameras.forEach((camera) => {
      const option = document.createElement("option");
      option.value = camera.deviceId;
      option.innerText = camera.label;
      if (currentCamera.label === camera.label) {
        option.selected = true;
      }
      camerasSelect.appendChild(option);
    });
  } catch (e) {
    console.log(e);
    alert(e)
  }
}




async function getMedia(deviceId) {
  

  // const devices = await navigator.mediaDevices.enumerateDevices();
  
  // // 마이크 체크 
  // var isMic = false;
  // muteBtn.hidden = true;
  // const micDevices = devices.filter((device) => device.kind === "audioinput");
 
  // if(micDevices.length > 0){
  //   isMic = isMic;
  //   muteBtn.hidden = false;
  // }
  

  // const initialConstrains = {
  //   audio: isMic,
  //   video: true,
  // };

  
  // const cameraConstraints = {
  //   audio: isMic,
  //   video: { deviceId: { exact: deviceId } },
  // };
  // try {
  //   myStream = await navigator.mediaDevices.getUserMedia(
  //     deviceId ? cameraConstraints : initialConstrains
  //   );
 
  //   myFace.srcObject = myStream;
  
  //   if (!deviceId) {
  //     await getCameras();
  //   }else{
  //     alert(deviceId);
  //   }
  // } catch (e) {
  //   console.log(e);
  //   alert(e);
  // }

  if(myStream){
    myStream.getTracks().forEach(track => {
      track.stop();
    });
  }

  const initialConstrains = {
    audio: false,
    video: { facingMode: "user" },
  };
  const cameraConstraints = {
    audio: false,
    video: { deviceId: { exact: deviceId } },
  };
  try {
    myStream = await navigator.mediaDevices.getUserMedia(
      deviceId ? cameraConstraints : initialConstrains
    );
    myFace.srcObject = myStream;
   
    
    if (!deviceId) {
      await getCameras();
    }
    
  } catch (e) {
    console.log(e);
  }
}

function handleMuteClick() {
  myStream
    .getAudioTracks()
    .forEach((track) => (track.enabled = !track.enabled));
  if (!muted) {
    muteBtn.innerText = "Unmute";
    muted = true;
  } else {
    muteBtn.innerText = "Mute";
    muted = false;
  }
}
function handleCameraClick() {
  myStream
    .getVideoTracks()
    .forEach((track) => (track.enabled = !track.enabled));
  if (cameraOff) {
    cameraBtn.innerText = "Turn Camera Off";
    cameraOff = false;
  } else {
    cameraBtn.innerText = "Turn Camera On";
    cameraOff = true;
  }
}

async function handleCameraChange() {
  
  await getMedia(camerasSelect.value);

  for(socketId in myPeerConnections){
    const myPeerConnection = myPeerConnections[socketId];  
    const videoTrack = myStream.getVideoTracks()[0];
      const videoSender = myPeerConnection
        .getSenders()
        .find((sender) => sender.track.kind === "video");
      videoSender.replaceTrack(videoTrack);
  }

}




muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);

// Welcome Form (join a room)

const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");

async function initCall(socketId) {
  welcome.hidden = true;
  call.hidden = false;
  await getMedia();

}

async function handleWelcomeSubmit(event) {
  event.preventDefault();
  const input = welcomeForm.querySelector("input");
  await initCall();
  socket.emit("join_room", input.value);
  roomName = input.value;
  input.value = "";
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);

// Socket Code
socket.on("welcome", async (users, socketId) => {

  mySocketId = socketId;

  users.forEach(async (user) =>{
    const myPeerConnection = await makeConnection(user.id);
    const offer = await myPeerConnection.createOffer();
    myPeerConnection.setLocalDescription(offer);
    console.log("sent the offer");
    socket.emit("offer", offer, user.id, mySocketId);
  })

});

socket.on("offer", async (offer, offerSendId) => {

  try {

    if(myPeerConnections[offerSendId]) return
    const myPeerConnection = await makeConnection(offerSendId)
    myPeerConnection.addEventListener("datachannel", (event) => {
      myDataChannel = event.channel;
      myDataChannel.addEventListener("message", (event) =>
        console.log(event.data)
      );
    });
    console.log("received the offer");
    
    myPeerConnection.setRemoteDescription(offer);
    const answer = await myPeerConnection.createAnswer();
    myPeerConnection.setLocalDescription(answer);
    socket.emit("answer", answer, offerSendId, mySocketId);
    console.log("sent the answer");
  } catch (error) {
    console.log(error)
  }

});

socket.on("answer", (answer, socketId) => {
  console.log("received the answer", socketId);
  const myPeerConnection = myPeerConnections[socketId];
  if(!myPeerConnection) return
  myPeerConnection.setRemoteDescription(answer);
  console.log(myPeerConnections)
});

socket.on("ice", (ice, socketId) => {
  console.log("received candidate", socketId);
  
  const myPeerConnection = myPeerConnections[socketId];
  if(!myPeerConnection) return
  myPeerConnection.addIceCandidate(ice);


  const {codecs} = RTCRtpSender.getCapabilities('video');

  codecs.forEach((codec) =>{
    console.log(codec)
  })
  let preferCodes = codecs.slice(6, 7);
  console.log(preferCodes);
  myPeerConnection.getTransceivers()[0].setCodecPreferences(preferCodes);
  console.log()
});

socket.on("userDisconnect", (socketId) => {
  console.log( "disconnect ::", socketId);
  
  if(otherVideoViews[socketId] !==  undefined){

    
  
    otherVideos.removeChild(otherVideoViews[socketId]);
    delete otherVideoViews[socketId]
    delete myPeerConnections[socketId]
    
    console.log(otherVideoViews);
    console.log(myPeerConnections)
  }

 
})

// RTC Code

async function makeConnection(socketId) {
  const myPeerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: [
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
          "stun:stun3.l.google.com:19302",
          "stun:stun4.l.google.com:19302",
        ],
      },
    ],
  });


  
  myPeerConnection.addEventListener("icecandidate", (data) =>{
    socket.emit("ice", data.candidate, mySocketId, socketId);
  });

  // 구세대 브라우저의 간의 api 변경으로 인한 분기
  if(myPeerConnection.addTrack !== undefined){
    // otherVideoArray
    myPeerConnection.addEventListener("track", (data) => {
    
      const peerFace = document.createElement("video");
      peerFace.setAttribute("autoplay", "");
      peerFace.setAttribute("playsinline", "");
      peerFace.srcObject = data.streams[0];
      peerFace.style.width = 50%
      otherVideos.append(peerFace);
      otherVideoViews[socketId] = peerFace;

    });
  }else{
    myPeerConnection.addEventListener("addstream", (data) => {

      const peerFace = document.createElement("video");
      peerFace.setAttribute("autoplay", "");
      peerFace.setAttribute("playsinline", "");
      peerFace.srcObject = data.stream;
      peerFace.autoplay = true;
      peerFace.style.width = 50%
      otherVideos.append(peerFace);
      otherVideoViews[socketId] = peerFace;

    });
  }
  
  // todo (상태 파악하여 디스커넥트 => socket connection 을 이용한 close 처리로 변경 ) 
  myPeerConnection.onconnectionstatechange = (e) =>{
    console.log(e)
  }
  myStream
    .getTracks()
    .forEach((track) => myPeerConnection.addTrack(track, myStream));

    myDataChannel = myPeerConnection.createDataChannel("chat");
    myDataChannel.addEventListener("message", (event) => console.log(event.data));
    console.log("made data channel");

 
  
    myPeerConnections[socketId] = myPeerConnection;
  return myPeerConnection;  
}

function handleIce(data) {
  console.log("sent candidate");
  socket.emit("ice", data.candidate, roomName);
}

