const { io } = require('socket.io-client');

const URL = 'http://localhost:3000';
let roomCode = null;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runTests() {
    console.log('🚀 Starting V5.6 Master Test Suite...');

    // 1. Connection
    const client1 = io(URL);
    const client2 = io(URL);
    await new Promise(r => client1.on('connect', r));
    await new Promise(r => client2.on('connect', r));
    console.log('✅ Clients Connected');

    // 2. Room Creation (5x5)
    await new Promise(resolve => {
        client1.emit('create_room', 5);
        client1.on('room_created', (code) => {
            roomCode = code;
            console.log(`✅ Room Created (5x5): ${code}`);
            resolve();
        });
    });

    // 3. Joining
    await new Promise(resolve => {
        client2.emit('join_room', roomCode);
        const listener = (data) => {
            if (data.gridSize === 5) {
                console.log('✅ Client 2 Joined & Verified 5x5 Grid');
                client2.off('game_start', listener); // Remove listener
                resolve();
            } else {
                console.error('❌ FAIL: Grid size mismatch', data.gridSize);
                process.exit(1);
            }
        };
        client2.on('game_start', listener);
    });

    // 4. Grid Change Mid-Game (Switch to 3x3)
    console.log('\n--- Testing Grid Change ---');
    client1.emit('request_grid_change', { roomCode, newSize: 3 });

    await new Promise(resolve => {
        const check = (data) => {
            if (data.gridSize === 3) {
                console.log('✅ Grid successfully changed to 3x3');
                resolve();
            }
        };
        // Expect game_start again with new size
        client1.on('game_start', check);
        client2.on('game_start', check);
    });

    // 5. Leave Room Logic
    console.log('\n--- Testing Leave Room ---');
    client2.emit('leave_room', roomCode);

    await new Promise(resolve => {
        client1.on('opponent_left', () => {
            console.log('✅ Client 1 received opponent_left signal');
            resolve();
        });
    });

    // Cleanup
    client1.disconnect();
    client2.disconnect();
    console.log('\n🎉 ALL V5.6 TESTS PASSED!');
    process.exit(0);
}

runTests().catch(err => {
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
});
