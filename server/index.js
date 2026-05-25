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

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
const executeRoute = require('./routes/execute');
app.use('/api/execute', executeRoute);

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../client/index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, '../client/auth.html')));
app.get('/editor/:roomId', (req, res) => res.sendFile(path.join(__dirname, '../client/editor.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, '../client/dashboard.html')));

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    httpServer.listen(process.env.PORT, () => {
      console.log(`✅ Server running on port ${process.env.PORT}`);
    });
  })
  .catch((err) => console.error('❌ MongoDB connection error:', err));

initSocket(io);