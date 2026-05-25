const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const authRoutes = require('./routes/auth');
const sessionRoutes = require('./routes/sessions');
const { initSocket } = require('./socket');

const app = express();
const httpServer = http.createServer(app);

// Set up Socket.io with CORS so frontend can connect
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ['GET', 'POST'],
  },
});

// Middleware — parse JSON, allow cross-origin requests
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

// ⚡ ADD THIS: Tell server to load files from client folder
app.use(express.static(path.join(__dirname, '../client')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);

// 🏠 1. Show the beautiful Landing Page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// 🔐 2. Show the Login/Signup Page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/auth.html'));
});

// ✏️ 3. Show the Code Editor when a room ID is opened
app.get('/editor/:roomId', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/editor.html'));
});

// 📊 3.5. Show the Sessions Dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dashboard.html'));
});

// 🚫 4. If someone goes to a page that doesn't exist, show the beautiful 404 Page!
app.get('/*splat', (req, res) => {
  res.status(404).sendFile(path.join(__dirname, '../client/404.html'));
});
// Connect to MongoDB, then start server
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    httpServer.listen(process.env.PORT, () => {
      console.log(`✅ Server running on port ${process.env.PORT}`);
    });
  })
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Initialize socket logic
initSocket(io);