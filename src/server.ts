import express, { Request, Response } from 'express';
import { Player, ConnectedUser } from './models/Interfaces'; 
import { generateLevelData } from './models/secuences.model';
import { connectDB } from './db';
import mongoose from 'mongoose';
import schemas from './models/player.model';
const { Player } = schemas;

import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
const MAX_CONNECTIONS = 7;
let connectedClients = 0;

const http = require('http');
const app = express();

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const desiredPort = 3000;

connectDB();

app.use(cors());
app.use(express.json());

let playerPendientes: Array<Response> = [];

const allClients: Response[] = [];

let connectedClientsMap = new Map<string, { ws: WebSocket, playerId: mongoose.Types.ObjectId }>();
const connectedUsers: ConnectedUser[] = [];
let generatedKeys: string[] = [];
let generatedScore: number;

// Short Polling 
app.get('/players', async (req: Request, res: Response) => {
  const jugadores = await schemas.Player.find({}, "name score");
  const jugador = jugadores.map(jugador => ({ name: jugador.name, score: jugador.score }));
  res.status(200).json({
    success: true,
    jugador
  });
});

// BORRAR TODOS LOS USUARIOS
app.delete('/players', async (req: Request, res: Response) => {
  try {
    await Player.deleteMany({});
    res.status(200).json({
      success: true,
      message: 'Todos los jugadores han sido eliminados.'
    });
  } catch (error) {
    console.error('Error al eliminar jugadores:', error);
    res.status(500).json({
      success: false,
      message: 'Se produjo un error al eliminar los jugadores.'
    });
  }
});

// Long Polling
app.get('/allPlayers', async (req: Request, res: Response) => {
  const jugadores = await schemas.Player.find({}, "name");
  const jugador = jugadores.map(jugador => ({ name: jugador.name }));
  res.status(200).json({
    success: true,
    jugador
  });
});

app.get("/nuevo-player", (req: Request, res: Response) => {
  playerPendientes.push(res);
});

function notificarNuevoPlayer(newPlayer: mongoose.Document & Player) {
  for (let res of playerPendientes) {
    res.status(200).json({
      success: true,
      newPlayer
    });
  }
  playerPendientes = [];
  notifyAllClients("connectedPlayers", connectedUsers);
}

// SSE
app.get("/all", async(req: Request, res:Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  allClients.push(res);

  req.on('close', () => {
      res.end();
  });

})

app.post("/user", (req: Request, res: Response) => {
  const data = req.body.user;

  const sseMessage = `event: user\n` +
                     `data: ${JSON.stringify(data)}\n\n`;

  for (let client of allClients) {
      client.write(sseMessage);
  }

  res.status(200).json({
      success: true,
      message: "evento enviado"
  });
});

// WebSockets
wss.on('connection', (ws: WebSocket) => {
  if (connectedClients >= MAX_CONNECTIONS) {
    ws.close(1000, 'Too many connections');
    return;
  }
  connectedClients++;
  console.log("Clientes conectados:", connectedClients);
  notifyAllClients("connectedPlayers", connectedUsers);

  // Variable local para almacenar el nombre de usuario conectado en esta sesión
  let connectedUserName = '';

  ws.on('message', async (data: string) => {
    const parsedMessage = JSON.parse(data);
    if (parsedMessage.type === 'nickname') {
      const playerName = parsedMessage.nickname;
      // Verificar si el usuario ya está registrado
      const existingPlayer = await Player.findOne({ name: playerName }).exec();
      if (existingPlayer) {
        console.log('Jugador ya registrado:', playerName);
        ws.send(JSON.stringify({ type: 'error', message: 'Nickname already taken' }));
        connectedClientsMap.set(playerName, { ws, playerId: existingPlayer._id });
        notifyAllClients("connectedPlayers", connectedUsers);
      } else {
        connectedUserName = parsedMessage.nickname;



        const newPlayer = new Player({
          id: new mongoose.Types.ObjectId(),
          name: playerName,
        });

        connectedUsers.push(newPlayer);
        await newPlayer.save();
        connectedClientsMap.set(parsedMessage.nickname, { ws, playerId: newPlayer._id });
        notificarNuevoPlayer(newPlayer)
        console.log('Nuevo jugador guardado en la base de datos:', playerName);
        notifyAllClients("connectedPlayers", connectedUsers);

          
        const jugadores = await schemas.Player.find({}, "name score");
        const jugador = jugadores.map(jugador => ({ name: jugador.name, score: jugador.score }));

        const jugadoress = await schemas.Player.find({}, "name");
        const jugadorr = jugadoress.map(jugador => ({ name: jugador.name }));

        const scores = `event: scores\n` + `data: ${JSON.stringify(jugador)}\n\n`;
        const playIn = `event: playIn\n` + `data: ${JSON.stringify(jugadorr)}\n\n`;

        for (let client of allClients) {
          client.write(scores);
          client.write(playIn)
      }
      }
    }
    switch (parsedMessage.action) {
      case "connectedPlayers":
        ws.send(JSON.stringify({
          event: "connectedPlayers",
          data: connectedUsers
        }));
        break;

      case "startGaming":
        const usuarioConectado = await schemas.Player.findOne({ name: connectedUserName });
        const userSession = connectedClientsMap.get(connectedUserName);
        if (userSession) {
          if (usuarioConectado) {
            const nivelUsuario = usuarioConectado.level;
            console.log("Nivel del usuario:", nivelUsuario);

            generatedKeys = generateLevelData(nivelUsuario).keys;
            generatedScore = generateLevelData(nivelUsuario).score;

            ws.send(JSON.stringify({
              event: "startGaming",
              data: generatedKeys
            }));
          } else {
            console.log("Usuario no encontrado en la base de datos");
          }
        }
        break;

        case "checKeys":
          const pressedKeysString = JSON.stringify(parsedMessage.keys);
          const generatedKeysString = JSON.stringify(generatedKeys);
          const Session = connectedClientsMap.get(connectedUserName);

          let updatedLives = 0;
        
          if (pressedKeysString === generatedKeysString) {
            if (Session) {
              await schemas.Player.updateOne(
                { _id: Session.playerId },
                { $inc: { score: generatedScore, level: 1 } }
              );
        
              console.log('Puntuación y nivel actualizados para el usuario:', connectedUserName);
              const updatedUser = await schemas.Player.findById(Session.playerId);
              updatedLives = updatedUser ? updatedUser.lives : 0;
            } else {
              console.log('Las teclas coinciden pero el usuario no está registrado.');
            }
          } else {
            if (Session) {
              console.log('Las teclas no coinciden. Se restará una vida al usuario.');
              // Reducir una vida del usuario
              await schemas.Player.updateOne(
                { _id: Session.playerId },
                { $inc: { lives: -1} } // Decrementar en 1 la cantidad de vidas
              );

              // Obtener la cantidad actualizada de vidas del usuario
              const updatedUser = await schemas.Player.findById(Session.playerId);
              updatedLives = updatedUser ? updatedUser.lives : 0;

              console.log('Cantidad de vidas actualizada para el usuario:', connectedUserName);
            } else {
              console.log('Las teclas no coinciden o el usuario no está registrado.');
            }
            
          }
          ws.send(JSON.stringify({
            event: "lives-",
            data: { lives: updatedLives }
          }));
          // Enviar la cantidad actualizada de vidas al cliente
          
          break;

      case "lives":
        const userLivesSession = connectedClientsMap.get(connectedUserName);
        if (userLivesSession) {
          const usuarioConectado = await schemas.Player.findById(userLivesSession.playerId);
          if (usuarioConectado) {
            
            ws.send(JSON.stringify({
              event: "lives",
              data: { lives: usuarioConectado.lives }
            }));
          } else {
            console.log("Usuario no encontrado en la base de datos");
          }
        }
        break;
    }

  });

  ws.on('close', () => {
    console.log("Cliente desconectado.");
    connectedClients--;
    const userSession = connectedClientsMap.get(connectedUserName);
    if (userSession) {
      const disconnectedUserIndex = connectedUsers.findIndex(user => user.name === connectedUserName);
      if (disconnectedUserIndex !== -1) {
        connectedUsers.splice(disconnectedUserIndex, 1);
        notifyAllClients("connectedPlayers", connectedUsers);
      } else {
        console.log("Usuario no encontrado en la lista de usuarios conectados.");
      }
      connectedClientsMap.delete(connectedUserName);
    } else {
      console.log("Sesión de usuario no encontrada.");
    }
  });

});

const notifyAllClients = (event: string, data: any) => {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ event, data }));
      console.log("cantidad de usuarios", connectedClients)
    }
  });
};

export let nivelUsuario: number;

server.listen(desiredPort, () => {
  console.log(`Server running in port:  ${desiredPort}`);
});