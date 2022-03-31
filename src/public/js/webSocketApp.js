const socket = io();

const welcome = document.getElementById("welcome");
const form = welcome.querySelector("form");
const room = document.getElementById("room");
const meesageList = room.querySelector("ul");
const roomList = welcome.querySelector("ul");

room.hidden = true

let roomName;

function addMessage(message){
  
  if(message){
    const ul = room.querySelector("ul")
    const li = document.createElement("li")
    li.innerText = `${message}`;
    ul.appendChild(li)
  }else{
    console.log("message is null")
  }
  
}

function showRoom(){
  room.hidden = false
  welcome.hidden = true
  const h3 = room.querySelector("h3");
  h3.innerText = roomName
  const name = room.querySelector("#name");
  const msg = room.querySelector("#msg");
  msg.addEventListener("submit", handleMessageSubmit);
  name.addEventListener("submit", handleNicknameSubmit)
}

function handleNicknameSubmit(event) {
  event.preventDefault();

  const form = room.querySelector("#name");;
  const input = form.querySelector("#name input");

  socket.emit("nickname", input.value, roomName, () =>{
    
  });
  input.value = "";
 
}

function handleMessageSubmit(event) {
    event.preventDefault();

    const form = room.querySelector("#msg");;
    const input = form.querySelector("#msg input");
    console.log(input.value);
    const msg = input.value
    socket.emit("new_message", msg, roomName, () =>{
      addMessage(`Yoo : ${msg}`)
    });
    input.value = "";
   
}

form.addEventListener("submit", handleRoomSubmit);

function handleRoomSubmit(event){
    event.preventDefault();
    const input = form.querySelector("input");
    roomName = input.value
    socket.emit("enter_room", input.value, showRoom);
    input.value = "";
}



socket.on("welcome", (nickName, newCount) => {
  const h3 = room.querySelector("h3");
  h3.innerText = `Room ${roomName} (${newCount})`;
  addMessage(`${nickName} joined!`)
})

socket.on("bye", (nickName, newCount) => {
  const h3 = room.querySelector("h3");
  h3.innerText = `Room ${roomName} (${newCount})`;
  addMessage(`${nickName} Left`)
})

socket.on("new_message", addMessage)

socket.on("room_change",(publicRooms) =>{

  console.log(publicRooms)
  roomList.innerHTML = ''
  if(publicRooms.length > 0){

   
    publicRooms.forEach(element => {
      const li = document.createElement("li")
      li.innerText = `${element}`;
      roomList.appendChild(li)
    });

  }else{

    const li = document.createElement("li")
    li.innerText = `생성된 방 없음`;
    roomList.appendChild(li)

  }
  
})