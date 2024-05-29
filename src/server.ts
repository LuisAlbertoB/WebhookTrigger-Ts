import express, { Request, Response } from 'express';
import { PlayerP, ConnectedUser } from './models/Interfaces'; 

import { connectDB } from './db';
import mongoose from 'mongoose';
import schemas from './models/player.model';

const { Player } = schemas;

import cors from 'cors'

import { WebSocketServer, WebSocket } from 'ws';
const MAX_CONNECTIONS = 5;
let connectedClients = 0;

const http = require('http');
const app = express();

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const desiredPort = 3000;

connectDB();

app.use(cors())
app.use(express.json());

let playerPendientes: Array<Response> = [];

let parsedMessage: { type: string, nickname: string } | null = null; // Declara parsedMessage fuera del alcance de los manejadores de eventos


const connectedUsers: ConnectedUser[] = []


// Short Polling 
app.get('/players', async (req: Request, res: Response) => {
  const jugadores = await schemas.Player.find({}, "name score");
  const jugador = jugadores.map(jugador => ({name: jugador.name, score: jugador.score}))
  res.status(200).json({
    sucess: true,
    jugador
  });
});
// Long Polling
app.get('/allPlayers', async (req: Request, res: Response) => {
  const jugadores = await schemas.Player.find({}, "name");
  const jugador = jugadores.map(jugador => ({name: jugador.name}))
  res.status(200).json({
    sucess: true,
    jugador
  });
});
app.get("/nuevo-player", (req: Request, res: Response) =>{
  playerPendientes.push(res)
})
app.post('/create-player', async (req: Request, res: Response) => {
  const newPlayer = new Player({
    id: new mongoose.Types.ObjectId(),
    name: req.body.name,
    score: req.body.score,
  });
  console.log(newPlayer)
  await newPlayer.save();
  notificarNuevoPlayer(newPlayer);
  res.status(200).json({ message: 'New player created' });
});

function notificarNuevoPlayer(newPlayer: mongoose.Document & PlayerP) {
  for (let res of playerPendientes) {
    res.status(200).json({
      success: true,
      newPlayer
    });
  }
  playerPendientes = []
}

// WebSockets
wss.on('connection', (ws: WebSocket) => {
  if (connectedClients >= MAX_CONNECTIONS) {
    ws.close(1000, 'Too many connections');
    return;
  }

  connectedClients++;
  console.log("Cliente conectado. C,lientes actuales:", connectedClients);

  ws.on('message', (data: string) => {
    try {
      const parsedMessage = JSON.parse(data);
      console.log("data: %s", data);

      if (parsedMessage.type === 'nickname') {
        console.log('Nickname recibido:', parsedMessage.nickname);
        const newUser: ConnectedUser = {
          name: parsedMessage.nickname
        };
        connectedUsers.push(newUser);
        
        wss.clients.forEach(client => {
          if(client.readyState == WebSocket.OPEN){
            client.send(JSON.stringify({
              event:"connectedPlayers",
              data: connectedUsers
            }))
          }
        })
      }
    } catch (error) {
      console.error('Failed to parse message', data);
    }
  });

  console.log(connectedUsers)


  ws.on('message', (data: string) => {
    console.log(data)

    const dataJson = JSON.parse(data)

    switch(dataJson.action){

      case "connectedPlayers":
        ws.send(JSON.stringify({
          event:"connectedPlayers",
          data: connectedUsers
        }))
      break;

    }
    
  })

  




  ws.on('close', () => {
    console.log("Cliente desconectado.");
    connectedClients--;
    // Encontrar el índice del usuario desconectado en el array de usuarios conectados
    const disconnectedUserIndex = connectedUsers.findIndex(name => name);

    if (disconnectedUserIndex !== -1) {
      connectedUsers.splice(disconnectedUserIndex, 1); // Eliminar al usuario desconectado del array
      console.log("Usuario desconectado. Usuarios actuales:", connectedUsers);
    } else {
      console.log("Usuario no encontrado en la lista de usuarios conectados.");
    }
  });

});



server.listen(desiredPort, () => {
  console.log(`Servidor Express en el puerto ${desiredPort}`);
});
