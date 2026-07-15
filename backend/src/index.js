import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { Chess } from 'chess.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const chess = new Chess();
let players = {};

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.render('index', { title: 'Chess Game' });
});

io.on('connection', (socketio) => {
    console.log('A user connected: ' + socketio.id);

    // Assign a role. NOTE: chess.js uses 'w' / 'b', not 'white' / 'black'.
    if (!players.w) {
        players.w = socketio.id;
        socketio.emit('playerRole', 'w');
    } else if (!players.b) {
        players.b = socketio.id;
        socketio.emit('playerRole', 'b');
    } else {
        socketio.emit('spectatorRole');
    }

    // Send current board state to whoever just connected (mid-game reconnects / spectators).
    socketio.emit('boardState', chess.fen());

    socketio.on('disconnect', () => {
        if (players.w === socketio.id) {
            delete players.w;
        } else if (players.b === socketio.id) {
            delete players.b;
        }
    });

    socketio.on('move', (move) => {
        try {
            // Turn check: chess.turn() returns 'w' or 'b'.
            if (chess.turn() === 'w' && players.w !== socketio.id) return;
            if (chess.turn() === 'b' && players.b !== socketio.id) return;

            const result = chess.move(move);
            if (result) {
                io.emit('move', result);
                io.emit('boardState', chess.fen());

                if (chess.isGameOver()) {
                    let reason = 'Game over';
                    if (chess.isCheckmate()) reason = `Checkmate — ${chess.turn() === 'w' ? 'black' : 'white'} wins`;
                    else if (chess.isStalemate()) reason = 'Stalemate';
                    else if (chess.isDraw()) reason = 'Draw';
                    io.emit('gameOver', reason);
                }
            } else {
                socketio.emit('invalidMove', move);
            }
        } catch (err) {
            console.error('Invalid move:', move, err.message);
            socketio.emit('invalidMove', move);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});