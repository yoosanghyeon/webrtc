const express = require('express')
const http = require('http')
const socketIO = require('socket.io')
const socketIOAdmin = require("@socket.io/admin-ui");
const port = 3000

const app = express();

app.set("view engine", "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));

app.get("/", (req, res) => res.render("home"));

app.get("/test",(req, res) => {
    res.send("Hello Test")    
})



const handleListen = () => console.log(`Listening on http://localhost:3000`);

const httpServer = http.createServer(app);
const wsServer = socketIO(httpServer, {
    cors: {
      origin: ["https://admin.socket.io"],
      credentials: true
    }
});

socketIOAdmin.instrument(wsServer, {
    auth: false
})

  

function publicRooms() {
    const {
      sockets: {
        adapter: { sids, rooms },
      },
    } = wsServer;
    const publicRooms = [];
    rooms.forEach((_, key) => {
      if (sids.get(key) === undefined) {
        publicRooms.push(key);
      }
    });
    return publicRooms;
  }

  function countRoom(roomName){
    return wsServer.sockets.adapter.rooms.get(roomName).size
  }

wsServer.on("connection",( socket )=>{
    
    socket.onAny((event) =>{
        console.log(`Socket Event : ${event}`)
    })
    wsServer.sockets.emit("room_change", publicRooms());
    socket.on("enter_room", function (roomName, done) {
   
        socket["nickname"] = "Anon"
        socket.join(roomName);
           
        if (done) {
            done();
            socket.to(roomName).emit("welcome", `${socket["nickname"]}`, countRoom(roomName));
            wsServer.sockets.emit("room_change", publicRooms());
        } else {
            console.log("fun null");
        }


    })

    socket.on("nickname", (nickname) => {
        socket["nickname"] = nickname
    })

    socket.on("disconnecting", () => {
        socket.rooms.forEach(room => {
            socket.to(room).emit("bye", `${socket["nickname"]}`, countRoom(room) - 1);
        });
    });

    socket.on("disconnect", () => {
        wsServer.sockets.emit("room_change", publicRooms());
    })

    socket.on("new_message", (msg, room, done) => {
        console.log(msg)
        socket.to(room).emit("new_message", `${socket["nickname"]} : ${msg}`)
        if(done){
            done(msg);
        }
    })

})



httpServer.listen(port, handleListen)

/* 
    function onSocketClose(){
        console.log("on socket close")
    }

    function onSocketMessage(message){
        console.log(message)
    }

    const wss = new webSocket.Server({server});
    const sockets = []
    const wss = new webSocket.Server({server});
    wss.on("connection", (socket) => {
    console.log("Connected to Browser ✅");
    socket.on("close", () => console.log("Disconnected from the Browser ❌"));
    
    sockets.push(socket)
    socket["nickname"] = "Anon"

    socket.on('message', function message(data, isBinary) {
        const message = isBinary ? data : data.toString();
        
        const parsed = JSON.parse(message)
        switch (parsed.type){
            case "new_message":
                sockets.forEach((aSocket) => {
                    aSocket.send(`${socket.nickname} : ${parsed.payload}`)
                })
            case "nickname":
                socket["nickname"] = parsed.payload    
        }
        // Continue as before.
            
      
    });
}); 
*/

