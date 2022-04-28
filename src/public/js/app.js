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
const otherFace = document.getElementById("otherFace");
const outerTitle = document.getElementById("outerTitle");
const roomTitle = document.getElementById("roomTitle");
const changeCodecsMenu = document.getElementById("changeCodecsMenu");
const videoCodecsSelects = document.getElementById("videoCodecsSelects");

call.hidden = true;

let myStream;
let muted = false;
let cameraOff = false;
let roomName;


let myPeerConnections = {};
let otherVideoViews = {};
let myDataChannel;

const supportsSetCodecPreferences = window.RTCRtpTransceiver &&
  'setCodecPreferences' in window.RTCRtpTransceiver.prototype;

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
  
  await getCodecs();
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
   
    micDevices.forEach((micDevice) => {
      console.log(micDevice);
    });
    
  }
  

  if(myStream){
    // Video만 변경
    myStream.getTracks().forEach(track => {

      if(track.kind == "video"){
        track.stop();
      }
    });
  }

  const initialConstrains = {
    audio: isMic,
    video: { 
      facingMode: "user" ,
      width : 240,
      height: 240,
      frameRate: {
          min: 7,
          max: 30
      }
    },
  };

  const cameraConstraints = {
    audio: isMic,
    video: { 
      deviceId: { exact: deviceId },
      width : 240,
      height: 240,
      frameRate: {
          min: 7,
          max: 30
      }
    }
  };

  try {
    myStream = await navigator.mediaDevices.getUserMedia(
      deviceId ? cameraConstraints : initialConstrains
    );

    // mic 볼륨 조절
    if(isMic){
      gotStream(myStream);
    }
  
      
    if (!deviceId) {
      await getCameras();
    }

    onMutued();

    myFace.srcObject = myStream; 
    otherFace.srcObject = myStream;


  } catch (e) {
    console.log(e);
  }
}

// temp sample code 
function onMutued(){
  muted = true;
  muteBtn.innerText = "Unmute";
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

    try{

      let videoTrack = myStream.getVideoTracks()[0];
      var sender = myPeerConnection.getSenders().find(function(s) {
        return s.track.kind == videoTrack.kind;
      });

      sender.replaceTrack(videoTrack);

    }catch(e){
      console.log( "switch camera error : ", e);
    }
    

  }

}


myFace.addEventListener("click", () =>{
  otherFace.srcObject = myFace.srcObject;
});

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);
videoCodecsSelects.addEventListener("input", handleCodecsChange);
micGain.addEventListener("input", (event) =>{
  
  changeMicrophoneLevel(micGain.value);
  gainValue.innerText = micGain.value;
  
});


const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");

async function initCall() {
  welcome.hidden = true;
  call.hidden = false;
  await getMedia();

}

async function handleWelcomeSubmit(event) {
  event.preventDefault();
  outerTitle.hidden = true;
  roomTitle.hidden = false;
  const input = welcomeForm.querySelector("input");
  await initCall();
  socket.emit("join_room", input.value);
  roomName = input.value;
  input.value = "";
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);

// Socket Code
socket.on("welcome", async (users, socketId) => {

  users.forEach(async (user) =>{
   
    const myPeerConnection = await makeConnection(user.id);
    const offer = await myPeerConnection.createOffer();
    myPeerConnection.setLocalDescription(offer);
    console.log("sent the offer");
    socket.emit("offer", offer, user.id, socket.id);
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
    socket.emit("answer", answer, offerSendId, socket.id);
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

});

socket.on("userDisconnect", (socketId) => {
  console.log( "disconnect ::", socketId);
  
  if(otherVideoViews[socketId] !==  undefined){

    if(otherVideoViews[socketId].srcObject.id === otherFace.srcObject.id){
      otherFace.srcObject = myStream;
    }

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
        urls: ['turn:101.101.209.28?transport=tcp' , 'turn:101.101.209.28?transport=udp'],
        credential: 'test123',
        username: 'test'
      }
    ]
  });

  

  myPeerConnection.addEventListener("icecandidate", (data) =>{
    socket.emit("ice", data.candidate, socket.id, socketId);
  });

  // 구세대 브라우저의 간의 api 변경으로 인한 분기
  if(myPeerConnection.addTrack !== undefined){

    // otherVideoArray
    myPeerConnection.addEventListener("track", (data) => {

      console.log(myPeerConnections);
      addOtherVideoData(socketId, data.streams[0]);

    });
  }else{
    
    myPeerConnection.addEventListener("addstream", (data) => {

      addOtherVideoData(socketId, data.stream);
    });
  }
  
  // todo (상태 파악하여 디스커넥트 => socket connection 을 이용한 close 처리로 변경 ) 
  myPeerConnection.addEventListener("onconnectionstatechange", (e) =>{
    console.log(e);
  })
    
  
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
  
  
  // codec 적용 
  if(supportsSetCodecPreferences){
    const transceiver = myPeerConnection.getTransceivers().find(t => t.sender && t.sender.track === myStream.getVideoTracks()[0]);
    if(transceiver){
      transceiver.setCodecPreferences(codecs);
      console.log("transceiver :: ", transceiver);
    }

  }

  myPeerConnections[socketId] = myPeerConnection;
  return myPeerConnection;  
}

function handleIce(data) {
  console.log("sent candidate");
  socket.emit("ice", data.candidate, roomName);
}

function addOtherVideoData(socketId, dataStream){
  if(otherVideoViews[socketId]) return;
  const peerFace = document.createElement("video");
  peerFace.setAttribute("autoplay", "");
  peerFace.setAttribute("playsinline", "");
  peerFace.srcObject = dataStream;
  peerFace.autoplay = true;
  peerFace.style.width = "120px";
  peerFace.style.height = "120px";
  peerFace.style.maxWidth = "4000px";
  peerFace.controls = false;

  otherVideos.append(peerFace);
  otherVideoViews[socketId] = peerFace;
  peerFace.addEventListener("click", () =>{
    console.log("click", peerFace.srcObject);
    otherFace.srcObject = peerFace.srcObject;
  })
}


let gainNode;
// mic volume contorol
function changeMicrophoneLevel(value) {
    if(value && value >= 0 && value <= 2) {
        gainNode.gain.value = value;
    }
}


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

var codecs;
let selectedCodecIndex
async function getCodecs(){

  // FireFox 지원 안함
  if(supportsSetCodecPreferences){
    capabilities = RTCRtpSender.getCapabilities("video");
     
    capabilities.codecs.forEach((codec) =>{

      if (['video/red', 'video/ulpfec', 'video/rtx'].includes(codec.mimeType)) {
        return;
      }
      const option = document.createElement("option");
      option.value = (codec.mimeType + ' ' + (codec.sdpFmtpLine || '')).trim();
      option.innerText = option.value;
   
      videoCodecsSelects.appendChild(option);
    });

    codecs = capabilities.codecs;
    selectedCodecIndex = codecs.findIndex((c) => {
      console.log(c.mimeType)
      return c.mimeType === "video/H264"
    });
    console.log("codecs index : ", selectedCodecIndex);
    codecs = codecs.splice(selectedCodecIndex, 1);
    
    console.log("codec :", codecs);
    videoCodecsSelects.selectedIndex = selectedCodecIndex;

  }else{
    changeCodecsMenu.hidden = true;
    videoCodecsSelects.hidden = true;
    videoCodecsSelects.disabled = true;
  }
  
}

async function handleCodecsChange() {
  
  console.log(videoCodecsSelects.value);
  alert("전송 코덱은 아직 바뀌지 않음");

}