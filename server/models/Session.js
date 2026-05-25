const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
    },
    title: {
      type: String,
      default: 'Untitled Session',
    },
    // Backward compatibility for single-file systems
    code: {
      type: String,
      default: '// Start coding here...\n',
    },
    language: {
      type: String,
      default: 'javascript',
    },
    // Multi-file filesystem mapping support
    files: {
      type: mongoose.Schema.Types.Mixed,
      default: {
        "index.js": {
          code: '// Start coding here...\n',
          language: 'javascript'
        }
      }
    },
    activeFile: {
      type: String,
      default: 'index.js'
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Session', sessionSchema);