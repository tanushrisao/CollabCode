const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const authMiddleware = require('../middleware/authMiddleware');

// Save a session (protected — must be logged in)
router.post('/save', authMiddleware, async (req, res) => {
  const { roomId, title, code, language, files, activeFile } = req.body;

  try {
    // Update if exists, create if not
    const session = await Session.findOneAndUpdate(
      { roomId },
      { 
        title: title || 'Untitled Session', 
        code: code || '', 
        language: language || 'javascript', 
        files: files || { "index.js": { code: code || '', language: language || 'javascript' } },
        activeFile: activeFile || "index.js",
        owner: req.user.userId 
      },
      { upsert: true, new: true }
    );
    res.json({ message: 'Session saved!', session });
  } catch (err) {
    console.error('Error saving session:', err);
    res.status(500).json({ message: 'Error saving session.' });
  }
});

// Get all sessions for the logged-in user (for Dashboard)
router.get('/my-sessions', authMiddleware, async (req, res) => {
  try {
    const sessions = await Session.find({ owner: req.user.userId }).sort({
      updatedAt: -1,
    });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching sessions.' });
  }
});

// Delete a session by roomId (protected — must be owner)
router.delete('/delete/:roomId', authMiddleware, async (req, res) => {
  try {
    const session = await Session.findOneAndDelete({ 
      roomId: req.params.roomId, 
      owner: req.user.userId 
    });
    if (!session) {
      return res.status(404).json({ message: 'Session not found or unauthorized.' });
    }
    res.json({ message: 'Session deleted successfully!' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting session.' });
  }
});

// Load a specific session by roomId
router.get('/:roomId', async (req, res) => {
  try {
    const session = await Session.findOne({ roomId: req.params.roomId });
    if (!session) return res.status(404).json({ message: 'Session not found.' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ message: 'Error loading session.' });
  }
});

module.exports = router;