const { io } = require("socket.io-client");

const SERVER_URL = 'http://localhost:3000'; // Test locally
const socket = io(SERVER_URL);
const gridSizeToTest = 5;

console.log('--- Testing Online Grid Logic ---');

socket.on('connect', () => {
    console.log('Connected to server, creating 5x5 room...');
    socket.emit('create_room', gridSizeToTest);
});

socket.on('room_created', (code) => {
    console.log(`Room created: ${code}. Waiting for validation...`);
    // We can't easily check internal server state, but we can have another client join and check the game_start event
    const joiner = io(SERVER_URL);
    joiner.on('connect', () => {
        joiner.emit('join_room', code);
    });

    joiner.on('game_start', (data) => {
        if (data.gridSize === gridSizeToTest) {
            console.log('SUCCESS: Server broadcasted correct grid size:', data.gridSize);
            process.exit(0);
        } else {
            console.error('FAILURE: Expected', gridSizeToTest, 'got', data.gridSize);
            process.exit(1);
        }
    });

    joiner.on('error_message', (msg) => {
        console.error('Join Error:', msg);
        process.exit(1);
    });
});

setTimeout(() => {
    console.error('Timeout waiting for response.');
    process.exit(1);
}, 5000);
