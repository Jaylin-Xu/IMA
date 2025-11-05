// import necessary modules
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static('public'));
app.use(express.json());

// Setup database
const defaultData = { combos: [] };
const adapter = new JSONFile('db.json');
const db = new Low(adapter, defaultData);

// Initialize database
await db.read();
db.data = db.data || defaultData;

// Get all combos
app.get('/combos', async (req, res) => {
  await db.read();
  let recentCombos = db.data.combos.slice(-50);
  res.json({ combos: recentCombos });
});

// Save new combo
app.post('/combos', async (req, res) => {
  let comboData = req.body;
  comboData.timestamp = new Date().toISOString();

  db.data.combos.push(comboData);
  await db.write();

  // Broadcast to all connected clients
  io.emit('newCombo', comboData);

  res.json({ success: true, combo: comboData });
});

// Clear all combos
app.delete('/combos', async (req, res) => {
  db.data.combos = [];
  await db.write();
  res.json({ success: true });
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = 3333;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
