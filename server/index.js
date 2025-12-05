const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

// Serve static files from the Vite build directory
app.use(express.static(path.join(__dirname, '../dist')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Store room state
const rooms = {};

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create_room', () => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = {
            players: [socket.id],
            board: Array(9).fill(''),
            turn: 'X'
        };
        socket.join(roomCode);
        socket.emit('room_created', roomCode);
        console.log(`Room ${roomCode} created by ${socket.id}`);
    });

    socket.on('join_room', (roomCode) => {
        const room = rooms[roomCode];
        if (room && room.players.length < 2) {
            room.players.push(socket.id);
            socket.join(roomCode);
            io.to(roomCode).emit('game_start', {
                roomCode,
                players: room.players
            });
            console.log(`User ${socket.id} joined room ${roomCode}`);
        } else {
            socket.emit('error_message', 'Room not found or full');
        }
    });

    socket.on('make_move', ({ roomCode, index, player }) => {
        const room = rooms[roomCode];
        if (room && room.turn === player && room.board[index] === '') {
            room.board[index] = player;
            room.turn = player === 'X' ? 'O' : 'X';

            io.to(roomCode).emit('move_made', {
                index,
                player,
                nextTurn: room.turn
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        for (const code in rooms) {
            if (rooms[code].players.includes(socket.id)) {
                io.to(code).emit('opponent_left');
                delete rooms[code];
                break;
            }
        }
    });
});

// Handle SPA routing - MUST be after API/Socket routes (though socket is separate)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
