// COLLABCODE PRO - REAL-TIME WEBSOCKETS LOGIC
// Stores all rooms, their multi-file structures, active files, and users.
const rooms = {};

function initSocket(io) {
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // JOIN ROOM - Supports both roomId and room key (for full compatibility)
    socket.on('join-room', ({ roomId, room, username }) => {
      const activeRoomId = roomId || room;
      if (!activeRoomId) return;

      socket.join(activeRoomId);

      // Create room structure if it doesn't exist
      if (!rooms[activeRoomId]) {
        rooms[activeRoomId] = {
          code: '// Start coding here...\n',
          language: 'javascript',
          files: {
            "index.js": {
              code: '// Start coding here...\n',
              language: 'javascript'
            }
          },
          activeFile: "index.js",
          users: [],
        };
      }

      // Add user to the room active list
      rooms[activeRoomId].users.push({ id: socket.id, username });

      // Send the current files structure and active selection to the joined client
      socket.emit('load-code', {
        code: rooms[activeRoomId].code,
        language: rooms[activeRoomId].language,
        files: rooms[activeRoomId].files,
        activeFile: rooms[activeRoomId].activeFile
      });

      // Notify everyone in the room of the updated active users
      io.to(activeRoomId).emit('room-users', rooms[activeRoomId].users);

      console.log(`${username} joined room ${activeRoomId}`);
    });

    // CODE CHANGE - Syncs typing character-by-character on a per-file basis
    socket.on('code-change', ({ roomId, room, code, filename }) => {
      const activeRoomId = roomId || room;
      const file = filename || "index.js";

      if (rooms[activeRoomId]) {
        // Track backward-compatible code field
        if (file === rooms[activeRoomId].activeFile || file === "index.js") {
          rooms[activeRoomId].code = code;
        }
        
        // Track per-file code
        if (!rooms[activeRoomId].files) {
          rooms[activeRoomId].files = {};
        }
        if (!rooms[activeRoomId].files[file]) {
          rooms[activeRoomId].files[file] = { code: "", language: "javascript" };
        }
        rooms[activeRoomId].files[file].code = code;
      }

      // Send the keystroke update to all other collaborators in the room
      socket.to(activeRoomId).emit('code-update', { code, filename: file });
    });

    // LANGUAGE SWITCH - Syncs code highlighting language on a per-file basis
    socket.on('language-change', ({ roomId, room, language, filename }) => {
      const activeRoomId = roomId || room;
      const file = filename || "index.js";

      if (rooms[activeRoomId]) {
        if (file === rooms[activeRoomId].activeFile || file === "index.js") {
          rooms[activeRoomId].language = language;
        }

        if (rooms[activeRoomId].files && rooms[activeRoomId].files[file]) {
          rooms[activeRoomId].files[file].language = language;
        }
      }

      socket.to(activeRoomId).emit('language-update', { language, filename: file });
    });

    // MULTI-FILE: FILE CREATION
    socket.on('file-create', ({ roomId, room, filename, language }) => {
      const activeRoomId = roomId || room;
      if (!activeRoomId || !filename) return;

      if (rooms[activeRoomId]) {
        if (!rooms[activeRoomId].files) rooms[activeRoomId].files = {};
        
        // Add new file with placeholder comment
        rooms[activeRoomId].files[filename] = {
          code: `// File: ${filename}\n`,
          language: language || 'javascript'
        };

        // Broadcast file creation to everyone in the room
        io.to(activeRoomId).emit('file-created', {
          filename,
          fileData: rooms[activeRoomId].files[filename]
        });
      }
    });

    // MULTI-FILE: FILE DELETION
    socket.on('file-delete', ({ roomId, room, filename }) => {
      const activeRoomId = roomId || room;
      if (!activeRoomId || !filename) return;

      if (rooms[activeRoomId] && rooms[activeRoomId].files && rooms[activeRoomId].files[filename]) {
        delete rooms[activeRoomId].files[filename];

        // If the deleted file was the active file, fallback to another file
        if (rooms[activeRoomId].activeFile === filename) {
          const remainingFiles = Object.keys(rooms[activeRoomId].files);
          rooms[activeRoomId].activeFile = remainingFiles[0] || "";
        }

        // Broadcast deletion event
        io.to(activeRoomId).emit('file-deleted', {
          filename,
          fallbackFile: rooms[activeRoomId].activeFile
        });
      }
    });

    // MULTI-FILE: FILE RENAME
    socket.on('file-rename', ({ roomId, room, oldFilename, newFilename }) => {
      const activeRoomId = roomId || room;
      if (!activeRoomId || !oldFilename || !newFilename) return;

      if (rooms[activeRoomId] && rooms[activeRoomId].files && rooms[activeRoomId].files[oldFilename]) {
        // Copy contents to new name, delete old
        rooms[activeRoomId].files[newFilename] = rooms[activeRoomId].files[oldFilename];
        delete rooms[activeRoomId].files[oldFilename];

        if (rooms[activeRoomId].activeFile === oldFilename) {
          rooms[activeRoomId].activeFile = newFilename;
        }

        // Broadcast rename event
        io.to(activeRoomId).emit('file-renamed', { oldFilename, newFilename });
      }
    });

    // MULTI-FILE: TAB SWITCH
    socket.on('file-switch', ({ roomId, room, filename }) => {
      const activeRoomId = roomId || room;
      if (!activeRoomId || !filename) return;

      if (rooms[activeRoomId]) {
        rooms[activeRoomId].activeFile = filename;
        // Optionally update the active code/language fields for legacy clients
        if (rooms[activeRoomId].files && rooms[activeRoomId].files[filename]) {
          rooms[activeRoomId].code = rooms[activeRoomId].files[filename].code;
          rooms[activeRoomId].language = rooms[activeRoomId].files[filename].language;
        }
      }
      
      // Let other collaborators know who is editing what (independent editor editing)
      socket.to(activeRoomId).emit('file-switched', { filename, socketId: socket.id });
    });

    // CHAT MESSAGING
    socket.on('send-message', ({ roomId, room, message, username }) => {
      const activeRoomId = roomId || room;
      if (!activeRoomId) return;

      // Broadcast text message to all other users in the room
      socket.to(activeRoomId).emit('receive-message', {
        message,
        username,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    });

    // RUN CODE BROADCAST (Output Syncing)
    socket.on('run-code', ({ roomId, room, logs, error }) => {
      const activeRoomId = roomId || room;
      if (!activeRoomId) return;
      socket.to(activeRoomId).emit('run-update', { logs, error });
    });

    // WebRTC PEER-TO-PEER VIDEO CALL SIGNALING
    socket.on('call-user', ({ roomId, room, userToCall, offer, from }) => {
      socket.to(userToCall).emit('call-made', {
        offer,
        socket: socket.id,
        username: from
      });
    });

    socket.on('make-answer', ({ roomId, room, to, answer }) => {
      socket.to(to).emit('answer-made', {
        socket: socket.id,
        answer
      });
    });

    socket.on('ice-candidate', ({ roomId, room, to, candidate }) => {
      socket.to(to).emit('ice-candidate-received', {
        socket: socket.id,
        candidate
      });
    });

    // DISCONNECT - Clean up active user rosters
    socket.on('disconnect', () => {
      for (const roomId in rooms) {
        const originalCount = rooms[roomId].users.length;
        rooms[roomId].users = rooms[roomId].users.filter((u) => u.id !== socket.id);

        if (rooms[roomId].users.length !== originalCount) {
          // Notify remaining collaborators of user leaving
          io.to(roomId).emit('room-users', rooms[roomId].users);
          socket.to(roomId).emit('user-left-call', { socketId: socket.id });
        }

        // Clean up empty rooms to save memory
        if (rooms[roomId].users.length === 0) {
          delete rooms[roomId];
        }
      }
      console.log(`User disconnected: ${socket.id}`);
    });
  });
}

module.exports = { initSocket };