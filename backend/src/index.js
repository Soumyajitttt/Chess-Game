import express from 'express';
import http from 'http';
import {Server} from 'socket.io';
import mongoose from 'mongoose';
import { Chess } from 'chess.js';
import path from 'path';
import { title } from 'process';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const chess = new Chess();
let players = {};
let currentTurn = 'white'; 

app.set('view engine', 'ejs');
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.render('index', {title: 'Chess Game'});
});

io.on('connection', (socket) => {
    console.log('A user connected: ' + socket.id);
});

server.listen(3000, () => {
    console.log('Server is running on port 3000');
});