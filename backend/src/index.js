import express from 'express';
import http from 'http';
import socket from 'socket.io';
import mongoose from 'mongoose';
import { Chess } from 'chess.js';

const app = exrpress();
const server = http.createServer(app);
const io = socket(server);


const chess = new Chess();

