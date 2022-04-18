const socket = io();

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");
const call = document.getElementById("call");
const otherVideos = document.getElementById("otherVideos");
const micMenu = document.getElementById("micMenu");
const micGain = document.getElementById("micGain");
const gainValue = document.getElementById("gainValue");

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
  

  const devices = await navigator.mediaDevices.enumerateDevices();
  
  // 마이크 체크 
  var isMic = false;
  muteBtn.hidden = true;
  micMenu.hidden = true;
  const micDevices = devices.filter((device) => device.kind === "audioinput");
 
  if(micDevices.length > 0){
    isMic = true;
    muteBtn.hidden = false;
    micMenu.hidden = false;
  }
  

  if(myStream){
    // TODO : readState -> audio 까지 서버림
    myStream.getTracks().forEach(track => {

      if(track.kind == "video"){
        track.stop();
      }
    });
  }

  const initialConstrains = {
    audio: isMic,
    video: { facingMode: "user" },
  };
  const cameraConstraints = {
    audio: isMic,
    video: { deviceId: { exact: deviceId } },
  };
  try {
    myStream = await navigator.mediaDevices.getUserMedia(
      deviceId ? cameraConstraints : initialConstrains
    );


  
      
    if (!deviceId) {
      await getCameras();
     
    }else{
      if(isMic){
        gotStream(myStream);
      }
    }

    onMutued()
    
    myFace.srcObject = myStream; 
  } catch (e) {
    console.log(e);
  }
}

// temp sample code 
function onMutued(){
  muted = true;
  myStream
  .getAudioTracks()
  .forEach((track) => (track.enabled = false));
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

  onMutued();
}

async function handleCameraChange() {
  
  await getMedia(camerasSelect.value);

   // TODO : AUDIO Track 바뀌는지 확인
  for(socketId in myPeerConnections){
    const myPeerConnection = myPeerConnections[socketId];  
    // const videoTrack = myStream.getVideoTracks()[0];

    //   const videoSender = myPeerConnection
    //     .getSenders()
    //     .find((sender) => sender.track.kind === "video");
    //   videoSender.replaceTrack(videoTrack);


    try{
      let videoTrack = myStream.getVideoTracks()[0];

      var sender = myPeerConnection.getSenders().find(function(s) {
        return s.track.kind == videoTrack.kind;
      });
      var audioSender = myPeerConnection.getSenders().find(function(s) {
        return s.track.kind == "audio";
      });
      console.log('vidio sender:', sender);
      console.log('audio sender:', audioSender);
      sender.replaceTrack(videoTrack);

    }catch(e){
      console.log( "switch camera error : ", e);
    }
    

  }

}




muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);
micGain.addEventListener("input", (event) =>{
  
  changeMicrophoneLevel(micGain.value);
  gainValue.innerText = micGain.value;
  
})


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
 
    console.log("offsend  id : " , offerSendId);

    if(myPeerConnections[offerSendId]) return;
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
    console.log(error);
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


  // const {codecs} = RTCRtpSender.getCapabilities('video');

  // codecs.forEach((codec) =>{
  //   console.log(codec)
  // })
  // let preferCodes = codecs.slice(6, 7);
  // console.log(preferCodes);
  // myPeerConnection.getTransceivers()[0].setCodecPreferences(preferCodes);
  // console.log()
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

socket.on("connect_error", (error) => {
  console.log(error);
});

// RTC Code

async function makeConnection(socketId) {
 
  console.log("makeConnection");
  if(myPeerConnections[socketId]){
    return
  }

  const myPeerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: 'turn:101.101.209.28',
        credential: 'test123',
        username: 'test'
      }
    ]
  });

  myPeerConnection.addEventListener("icecandidate", (data) =>{
    socket.emit("ice", data.candidate, mySocketId, socketId);
  });

  // 구세대 브라우저의 간의 api 변경으로 인한 분기
  if(myPeerConnection.addTrack !== undefined){

    // otherVideoArray
    myPeerConnection.addEventListener("track", (data) => {

      console.log(myPeerConnections);
      if(otherVideoViews[socketId]) return;
      
      const peerFace = document.createElement("video");
      peerFace.setAttribute("autoplay", "");
      peerFace.setAttribute("playsinline", "");
      // peerFace.setAttribute("controls", "");
      peerFace.srcObject = data.streams[0];
      peerFace.style.width = 50%
      otherVideos.append(peerFace);
      otherVideoViews[socketId] = peerFace;
      console.log(peerFace);
    });
  }else{
    
    myPeerConnection.addEventListener("addstream", (data) => {

       if(otherVideoViews[socketId]) return;
      const peerFace = document.createElement("video");
      peerFace.setAttribute("autoplay", "");
      peerFace.setAttribute("playsinline", "");
      // peerFace.setAttribute("controls", "");
      peerFace.srcObject = data.stream;
      peerFace.autoplay = true;
      peerFace.style.width = 50%
      otherVideos.append(peerFace);
      otherVideoViews[socketId] = peerFace;
      console.log(peerFace);
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

  // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/restartIce
  myPeerConnection.addEventListener("iceconnectionstatechange", event => {
    console.log(event)
    if (myPeerConnection.iceConnectionState === "failed") {
      /* possibly reconfigure the connection in some way here */
      /* then request ICE restart */
      myPeerConnection.restartIce();
    }
  });
  
  myPeerConnections[socketId] = myPeerConnection;
  return myPeerConnection;  
}

function handleIce(data) {
  console.log("sent candidate");
  socket.emit("ice", data.candidate, roomName);
}


// mic volume contorol
function changeMicrophoneLevel(value) {
    if(value && value >= 0 && value <= 2) {
        gainNode.gain.value = value;
    }
}
let gainNode;

function gotStream(stream) {

  // Get the videoTracks from the stream.
  const videoTracks = stream.getVideoTracks();

  /**
   * Create a new audio context and build a stream source,
   * stream destination and a gain node. Pass the stream into 
   * the mediaStreamSource so we can use it in the Web Audio API.
   */
  const context = new AudioContext();
  const mediaStreamSource = context.createMediaStreamSource(stream);
  const mediaStreamDestination = context.createMediaStreamDestination();
  gainNode = context.createGain();
  gainNode.gain.value = 1.0;
  /**
   * Connect the stream to the gainNode so that all audio
   * passes through the gain and can be controlled by it.
   * Then pass the stream from the gain to the mediaStreamDestination
   * which can pass it back to the RTC client.
   */
  mediaStreamSource.connect(gainNode);
  gainNode.connect(mediaStreamDestination);

  /**
   * Change the gain levels on the input selector.
   */
  // inputLevelSelector.addEventListener('input', event => {
  //   gainNode.gain.value = event.target.value;
  // });

  /**
   * The mediaStreamDestination.stream outputs a MediaStream object
   * containing a single AudioMediaStreamTrack. Add the video track
   * to the new stream to rejoin the video with the controlled audio.
   */
  const controlledStream = mediaStreamDestination.stream;
  for (const videoTrack of videoTracks) {
    controlledStream.addTrack(videoTrack);
  }

  /**
   * Use the stream that went through the gainNode. This
   * is the same stream but with altered input volume levels.
   */
  // localVideo.srcObject = controlledStream;
  myStream = controlledStream;
  // peerConnection.addStream(controlledStream);
  // callButton.disabled = false;

}

