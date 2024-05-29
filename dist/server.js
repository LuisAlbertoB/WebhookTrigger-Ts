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
const express_1 = __importDefault(require("express"));
const db_1 = require("./db");
const mongoose_1 = __importDefault(require("mongoose"));
const player_model_1 = __importDefault(require("./models/player.model"));
const { Player } = player_model_1.default;
const cors_1 = __importDefault(require("cors"));
const ws_1 = require("ws");
const MAX_CONNECTIONS = 5;
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
let parsedMessage = null; // Declara parsedMessage fuera del alcance de los manejadores de eventos
const connectedUsers = [];
// Short Polling 
app.get('/players', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const jugadores = yield player_model_1.default.Player.find({}, "name score");
    const jugador = jugadores.map(jugador => ({ name: jugador.name, score: jugador.score }));
    res.status(200).json({
        sucess: true,
        jugador
    });
}));
// Long Polling
app.get('/allPlayers', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const jugadores = yield player_model_1.default.Player.find({}, "name");
    const jugador = jugadores.map(jugador => ({ name: jugador.name }));
    res.status(200).json({
        sucess: true,
        jugador
    });
}));
app.get("/nuevo-player", (req, res) => {
    playerPendientes.push(res);
});
app.post('/create-player', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const newPlayer = new Player({
        id: new mongoose_1.default.Types.ObjectId(),
        name: req.body.name,
        score: req.body.score,
    });
    console.log(newPlayer);
    yield newPlayer.save();
    notificarNuevoPlayer(newPlayer);
    res.status(200).json({ message: 'New player created' });
}));
function notificarNuevoPlayer(newPlayer) {
    for (let res of playerPendientes) {
        res.status(200).json({
            success: true,
            newPlayer
        });
    }
    playerPendientes = [];
}
// WebSockets
wss.on('connection', (ws) => {
    if (connectedClients >= MAX_CONNECTIONS) {
        ws.close(1000, 'Too many connections');
        return;
    }
    connectedClients++;
    console.log("Cliente conectado. C,lientes actuales:", connectedClients);
    ws.on('message', (data) => {
        try {
            const parsedMessage = JSON.parse(data);
            console.log("data: %s", data);
            if (parsedMessage.type === 'nickname') {
                console.log('Nickname recibido:', parsedMessage.nickname);
                const newUser = {
                    name: parsedMessage.nickname
                };
                connectedUsers.push(newUser);
                wss.clients.forEach(client => {
                    if (client.readyState == ws_1.WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            event: "connectedPlayers",
                            data: connectedUsers
                        }));
                    }
                });
            }
        }
        catch (error) {
            console.error('Failed to parse message', data);
        }
    });
    console.log(connectedUsers);
    ws.on('message', (data) => {
        console.log(data);
        const dataJson = JSON.parse(data);
        switch (dataJson.action) {
            case "connectedPlayers":
                ws.send(JSON.stringify({
                    event: "connectedPlayers",
                    data: connectedUsers
                }));
                break;
        }
    });
    ws.on('close', () => {
        console.log("Cliente desconectado.");
        connectedClients--;
        // Encontrar el índice del usuario desconectado en el array de usuarios conectados
        const disconnectedUserIndex = connectedUsers.findIndex(name => name);
        if (disconnectedUserIndex !== -1) {
            connectedUsers.splice(disconnectedUserIndex, 1); // Eliminar al usuario desconectado del array
            console.log("Usuario desconectado. Usuarios actuales:", connectedUsers);
        }
        else {
            console.log("Usuario no encontrado en la lista de usuarios conectados.");
        }
    });
});
server.listen(desiredPort, () => {
    console.log(`Servidor Express en el puerto ${desiredPort}`);
});
