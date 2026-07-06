import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { Chess } from 'chess.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { error, log } from 'console';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const chess = new Chess();
let players = {};
let currentTurn = 'white';

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.render('index', { title: 'Chess Game' });
});

io.on('connection', (socketio) => {
    console.log('A user connected: ' + socketio.id);

    if(!players.white) {
        players.white = socketio.id;
        socketio.emit('currentPlayer', 'white');
    } else if(!players.black) {
        players.black = socketio.id;
        socketio.emit('currentPlayer', 'black');
    } else {
        socketio.emit('spectator');
    }
    socketio.on('disconnect', () => {
        if(players.white === socketio.id) {
            delete players.white;
        } else if(players.black === socketio.id) {
            delete players.black;
        }
    });

    socketio.on('move', (move) => {
        try {
            if((chess.turn() === 'white' && players.white !== socketio.id) || (chess.turn() === 'black' && players.black !== socketio.id)) {
                console.error('Not your turn!');
                return;
            }
            const res = chess.move(move);
            if(res) {
                currentTurn = chess.turn() ;
                io.emit('move', move);
                io.emit('boardState', chess.fen());
            }else{
                console.log('Invalid move:', move);
                socketio.emit('invalidMove', move);
            }
        } catch (error) {
            console.error('Invalid move:', move);
            socketio.emit('invalidMove', move);
        }
    })
});

server.listen(3000, () => {
    console.log('Server is running on port 3000');
});