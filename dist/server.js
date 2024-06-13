"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.nivelUsuario = void 0;
const express_1 = __importDefault(require("express"));
const secuences_model_1 = require("./models/secuences.model");
const db_1 = require("./db");
const mongoose_1 = __importDefault(require("mongoose"));
const player_model_1 = __importDefault(require("./models/player.model"));
const { Player } = player_model_1.default;
const cors_1 = __importDefault(require("cors"));
const ws_1 = require("ws");
const MAX_CONNECTIONS = 7;
let connectedClients = 0;
const http = require('http');
const app = (0, express_1.default)();
const server = http.createServer(app);
const wss = new ws_1.WebSocketServer({ server });
const desiredPort = 3000;
(0, db_1.connectDB)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
let playerPendientes = [];
const allClients = [];
let connectedClientsMap = new Map();
const connectedUsers = [];
let generatedKeys = [];
let generatedScore;
// Short Polling 
app.get('/players', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const jugadores = yield player_model_1.default.Player.find({}, "name score");
    const jugador = jugadores.map(jugador => ({ name: jugador.name, score: jugador.score }));
    res.status(200).json({
        success: true,
        jugador
    });
}));
// BORRAR TODOS LOS USUARIOS
app.delete('/players', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield Player.deleteMany({});
        res.status(200).json({
            success: true,
            message: 'Todos los jugadores han sido eliminados.'
        });
    }
    catch (error) {
        console.error('Error al eliminar jugadores:', error);
        res.status(500).json({
            success: false,
            message: 'Se produjo un error al eliminar los jugadores.'
        });
    }
}));
// Long Polling
app.get('/allPlayers', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const jugadores = yield player_model_1.default.Player.find({}, "name");
    const jugador = jugadores.map(jugador => ({ name: jugador.name }));
    res.status(200).json({
        success: true,
        jugador
    });
}));
app.get("/nuevo-player", (req, res) => {
    playerPendientes.push(res);
});
function notificarNuevoPlayer(newPlayer) {
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
app.get("/all", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    allClients.push(res);
    req.on('close', () => {
        res.end();
    });
}));
app.post("/user", (req, res) => {
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
wss.on('connection', (ws) => {
    if (connectedClients >= MAX_CONNECTIONS) {
        ws.close(1000, 'Too many connections');
        return;
    }
    connectedClients++;
    console.log("Clientes conectados:", connectedClients);
    notifyAllClients("connectedPlayers", connectedUsers);
    // Variable local para almacenar el nombre de usuario conectado en esta sesión
    let connectedUserName = '';
    ws.on('message', (data) => __awaiter(void 0, void 0, void 0, function* () {
        const parsedMessage = JSON.parse(data);
        if (parsedMessage.type === 'nickname') {
            const playerName = parsedMessage.nickname;
            // Verificar si el usuario ya está registrado
            const existingPlayer = yield Player.findOne({ name: playerName }).exec();
            if (existingPlayer) {
                console.log('Jugador ya registrado:', playerName);
                ws.send(JSON.stringify({ type: 'error', message: 'Nickname already taken' }));
                connectedClientsMap.set(playerName, { ws, playerId: existingPlayer._id });
                notifyAllClients("connectedPlayers", connectedUsers);
            }
            else {
                connectedUserName = parsedMessage.nickname;
                const newPlayer = new Player({
                    id: new mongoose_1.default.Types.ObjectId(),
                    name: playerName,
                });
                connectedUsers.push(newPlayer);
                yield newPlayer.save();
                connectedClientsMap.set(parsedMessage.nickname, { ws, playerId: newPlayer._id });
                notificarNuevoPlayer(newPlayer);
                console.log('Nuevo jugador guardado en la base de datos:', playerName);
                notifyAllClients("connectedPlayers", connectedUsers);
                const jugadores = yield player_model_1.default.Player.find({}, "name score");
                const jugador = jugadores.map(jugador => ({ name: jugador.name, score: jugador.score }));
                const jugadoress = yield player_model_1.default.Player.find({}, "name");
                const jugadorr = jugadoress.map(jugador => ({ name: jugador.name }));
                const scores = `event: scores\n` + `data: ${JSON.stringify(jugador)}\n\n`;
                const playIn = `event: playIn\n` + `data: ${JSON.stringify(jugadorr)}\n\n`;
                for (let client of allClients) {
                    client.write(scores);
                    client.write(playIn);
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
                const usuarioConectado = yield player_model_1.default.Player.findOne({ name: connectedUserName });
                const userSession = connectedClientsMap.get(connectedUserName);
                if (userSession) {
                    if (usuarioConectado) {
                        const nivelUsuario = usuarioConectado.level;
                        console.log("Nivel del usuario:", nivelUsuario);
                        generatedKeys = (0, secuences_model_1.generateLevelData)(nivelUsuario).keys;
                        generatedScore = (0, secuences_model_1.generateLevelData)(nivelUsuario).score;
                        ws.send(JSON.stringify({
                            event: "startGaming",
                            data: generatedKeys
                        }));
                    }
                    else {
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
                        yield player_model_1.default.Player.updateOne({ _id: Session.playerId }, { $inc: { score: generatedScore, level: 1 } });
                        console.log('Puntuación y nivel actualizados para el usuario:', connectedUserName);
                        const updatedUser = yield player_model_1.default.Player.findById(Session.playerId);
                        updatedLives = updatedUser ? updatedUser.lives : 0;
                    }
                    else {
                        console.log('Las teclas coinciden pero el usuario no está registrado.');
                    }
                }
                else {
                    if (Session) {
                        console.log('Las teclas no coinciden. Se restará una vida al usuario.');
                        // Reducir una vida del usuario
                        yield player_model_1.default.Player.updateOne({ _id: Session.playerId }, { $inc: { lives: -1 } } // Decrementar en 1 la cantidad de vidas
                        );
                        // Obtener la cantidad actualizada de vidas del usuario
                        const updatedUser = yield player_model_1.default.Player.findById(Session.playerId);
                        updatedLives = updatedUser ? updatedUser.lives : 0;
                        console.log('Cantidad de vidas actualizada para el usuario:', connectedUserName);
                    }
                    else {
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
                    const usuarioConectado = yield player_model_1.default.Player.findById(userLivesSession.playerId);
                    if (usuarioConectado) {
                        ws.send(JSON.stringify({
                            event: "lives",
                            data: { lives: usuarioConectado.lives }
                        }));
                    }
                    else {
                        console.log("Usuario no encontrado en la base de datos");
                    }
                }
                break;
        }
    }));
    ws.on('close', () => {
        console.log("Cliente desconectado.");
        connectedClients--;
        const userSession = connectedClientsMap.get(connectedUserName);
        if (userSession) {
            const disconnectedUserIndex = connectedUsers.findIndex(user => user.name === connectedUserName);
            if (disconnectedUserIndex !== -1) {
                connectedUsers.splice(disconnectedUserIndex, 1);
                notifyAllClients("connectedPlayers", connectedUsers);
            }
            else {
                console.log("Usuario no encontrado en la lista de usuarios conectados.");
            }
            connectedClientsMap.delete(connectedUserName);
        }
        else {
            console.log("Sesión de usuario no encontrada.");
        }
    });
});
const notifyAllClients = (event, data) => {
    wss.clients.forEach(client => {
        if (client.readyState === ws_1.WebSocket.OPEN) {
            client.send(JSON.stringify({ event, data }));
            console.log("cantidad de usuarios", connectedClients);
        }
    });
};
server.listen(desiredPort, () => {
    console.log(`Server running in port:  ${desiredPort}`);
});
