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
const webhook_model_1 = require("./models/webhook.model");
const { Player } = player_model_1.default;
const cors_1 = __importDefault(require("cors"));
const ws_1 = require("ws");
const axios_1 = __importDefault(require("axios")); // Importar axios
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
// Función para disparar los webhooks
function triggerWebhooks(eventType, eventData) {
    return __awaiter(this, void 0, void 0, function* () {
        const webhooks = yield webhook_model_1.Webhook.find({});
        for (const webhook of webhooks) {
            try {
                yield axios_1.default.post(webhook.url, {
                    event: eventType,
                    data: eventData
                });
            }
            catch (error) {
                console.error(`Error triggering webhook ${webhook.url}:`, error);
            }
        }
    });
}
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
    triggerWebhooks('newPlayer', newPlayer); // Disparar el webhook al registrar un nuevo jugador
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
// WEBHOOKS
app.post('/webhooks', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const url = req.body.webhook;
    try {
        if (!url) {
            return res.status(400).json({ success: false, message: 'Se requiere una URL para el webhook.' });
        }
        const newWebhook = new webhook_model_1.Webhook({ url });
        yield newWebhook.save(); // Guarda el nuevo webhook en la base de datos
        res.status(201).json({ success: true, webhook: newWebhook });
    }
    catch (error) {
        console.error('Error al crear el webhook:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
}));
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
                notificarNuevoPlayer(newPlayer); // Notificar y disparar el webhook
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
                        yield player_model_1.default.Player.updateOne({ _id: Session.playerId }, { $inc: { lives: -1 } });
                        // Obtener la cantidad actualizada de vidas del usuario
                        const updatedUser = yield player_model_1.default.Player.findById(Session.playerId);
                        updatedLives = updatedUser ? updatedUser.lives : 0;
                    }
                }
                ws.send(JSON.stringify({
                    event: "checKeys",
                    data: {
                        success: pressedKeysString === generatedKeysString,
                        updatedLives
                    }
                }));
                break;
            default:
                console.log('Acción no reconocida:', parsedMessage.action);
        }
    }));
    ws.on('close', () => {
        connectedClients--;
        console.log("Clientes conectados:", connectedClients);
    });
});
function notifyAllClients(event, data) {
    wss.clients.forEach((client) => {
        if (client.readyState === ws_1.WebSocket.OPEN) {
            client.send(JSON.stringify({
                event,
                data
            }));
        }
    });
}
server.listen(desiredPort, () => {
    console.log(`Servidor escuchando en el puerto ${desiredPort}`);
});
