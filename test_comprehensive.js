import { io } from 'socket.io-client';

const URL = 'http://localhost:3000';
let roomCode = null;

// Helper to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runTests() {
    console.log('🚀 Starting Comprehensive Tests...');

    // 1. Connection Test
    console.log('\n--- 1. Connection Test ---');
    const client1 = io(URL);
    const client2 = io(URL);

    await new Promise(resolve => client1.on('connect', resolve));
    console.log('✅ Client 1 Connected');
    await new Promise(resolve => client2.on('connect', resolve));
    console.log('✅ Client 2 Connected');

    // 2. Room Creation & Joining
    console.log('\n--- 2. Room Creation & Joining ---');
    await new Promise(resolve => {
        client1.emit('create_room');
        client1.on('room_created', (code) => {
            roomCode = code;
            console.log(`✅ Room Created: ${code}`);
            resolve();
        });
    });

    await new Promise(resolve => {
        client2.emit('join_room', roomCode);
        client2.on('game_start', (data) => {
            if (data.roomCode === roomCode) {
                console.log('✅ Client 2 Joined & Game Started');
                resolve();
            }
        });
    });

    // 3. Gameplay Logic (X Wins)
    console.log('\n--- 3. Gameplay Logic (X Wins) ---');
    // Moves: X(0) -> O(3) -> X(1) -> O(4) -> X(2) [Win]

    // Move 1: X(0)
    client1.emit('make_move', { roomCode, index: 0, player: 'X' });
    await new Promise(resolve => client2.on('move_made', (data) => {
        if (data.player === 'X' && data.index === 0) resolve();
    }));
    console.log('✅ Move 1: X(0) verified');

    // Move 2: O(3)
    client2.emit('make_move', { roomCode, index: 3, player: 'O' });
    await new Promise(resolve => client1.on('move_made', (data) => {
        if (data.player === 'O' && data.index === 3) resolve();
    }));
    console.log('✅ Move 2: O(3) verified');

    // Move 3: X(1)
    client1.emit('make_move', { roomCode, index: 1, player: 'X' });
    await delay(100);

    // Move 4: O(4)
    client2.emit('make_move', { roomCode, index: 4, player: 'O' });
    await delay(100);

    // Move 5: X(2) [WIN]
    client1.emit('make_move', { roomCode, index: 2, player: 'X' });
    console.log('✅ Move 5: X(2) sent (Winning Move)');

    // 4. Restart Logic
    console.log('\n--- 4. Restart Logic ---');
    // Client 1 requests restart
    client1.emit('restart_request', roomCode);

    await new Promise(resolve => {
        let restarts = 0;
        const check = () => {
            restarts++;
            if (restarts === 2) { // Both clients receive it
                console.log('✅ Restart Signal received by both clients');
                resolve();
            }
        };
        client1.on('game_restarted', check);
        client2.on('game_restarted', check);
    });

    // 5. Invalid Role Test (Client 2 trying to play as X)
    console.log('\n--- 5. Security/Validation Test ---');
    client2.emit('make_move', { roomCode, index: 8, player: 'X' }); // Should be ignored
    // We expect NO 'move_made' event.
    let hacked = false;
    const hackListener = () => { hacked = true; };
    client1.on('move_made', hackListener);
    await delay(500);
    client1.off('move_made', hackListener);

    if (!hacked) {
        console.log('✅ Server correctly ignored invalid move (O playing as X)');
    } else {
        console.error('❌ FAIL: Server accepted invalid move!');
        process.exit(1);
    }

    // Cleanup
    client1.disconnect();
    client2.disconnect();
    console.log('\n🎉 ALL TESTS PASSED!');
    process.exit(0);
}

runTests().catch(err => {
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
});
