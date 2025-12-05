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
