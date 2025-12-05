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

    socket.on('create_room', (gridSize = 3) => {
        const roomCode = generateRoomCode();
        const size = parseInt(gridSize) || 3;
        rooms[roomCode] = {
            players: [socket.id],
            playerMap: { [socket.id]: 'X' }, // Map socket to symbol
            board: Array(size * size).fill(''),
            turn: 'X',
            gridSize: size
        };
        socket.join(roomCode);
        socket.emit('room_created', roomCode);
        console.log(`Room ${roomCode} created by ${socket.id} (Size: ${size}x${size})`);
    });

    socket.on('join_room', (roomCode) => {
        const room = rooms[roomCode];
        if (room && room.players.length < 2) {
            room.players.push(socket.id);
            room.playerMap[socket.id] = 'O'; // Assign O to joiner
            socket.join(roomCode);
            io.to(roomCode).emit('game_start', {
                roomCode,
                players: room.players,
                gridSize: room.gridSize // Send size to joiner
            });
            console.log(`User ${socket.id} joined room ${roomCode}`);
        } else {
            socket.emit('error_message', 'Room not found or full');
        }
    });

    socket.on('make_move', ({ roomCode, index, player }) => {
        const room = rooms[roomCode];
        // Validate room, turn, cell vacancy AND that the socket matches the player role
        if (room &&
            room.turn === player &&
            index >= 0 && index < room.board.length && // Dynamic Bounds Check
            room.board[index] === '' &&
            room.playerMap[socket.id] === player // Security Check
        ) {
            room.board[index] = player;
            room.turn = player === 'X' ? 'O' : 'X';

            io.to(roomCode).emit('move_made', {
                index,
                player,
                nextTurn: room.turn
            });
        }
    });

    socket.on('restart_request', (roomCode) => {
        const room = rooms[roomCode];
        if (room) {
            room.board = Array(room.gridSize * room.gridSize).fill('');
            room.turn = 'X';
            io.to(roomCode).emit('game_restarted');
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
