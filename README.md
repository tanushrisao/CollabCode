# COLLABCODE Pro 🚀

**COLLABCODE** is a premium, real-time collaborative code editor and in-browser IDE workspace. It enables multiple developers to write, run, and share code synchronously from anywhere in the world—complete with multi-file support, sandboxed compilations, instant text chat, and zero-latency WebRTC video/voice streams.

---

## ✨ Key Features

* ✏️ **Monaco Editor Core**: Features the exact same editing engine that powers VS Code inside the browser. Includes syntax highlighting, line numbers, brackets auto-close, word wrap, and smooth caret animations.
* 🗂️ **Multi-File Tab Bar**: Switch, create, rename, and delete multiple files in one coding session. Monaco models are swapped dynamically, keeping separate undo-redo histories per file.
* 🔴 **Keystroke Syncing**: Typing, language changes, and file updates are synchronized character-by-character in real-time over Socket.io WebSockets.
* 👥 **Online Collaborators roster**: Stacked user avatars overlapping with hover-to-reveal tooltips and active count badges.
* 💬 **Sliding Chat Sidebar**: Collapsible messaging drawer to exchange text messages, complete with notification indicators on the toolbar.
* 📞 **WebRTC Video/Voice Calls**: Zero-cost peer-to-peer visual camera grid and mic channels utilizing Socket.io as an ICE signaling broker. Includes mic/camera toggles.
* 🐍 **Sandboxed Compiler (Piston API)**: Execute JavaScript locally, and Python, TypeScript, HTML, CSS, JSON, or Markdown via a secure cloud sandbox. stdout and compilation errors render in a modular Output Panel.
* 🎨 **IDE Themes**: Hot-swap workspace visuals between Space Dark, Retro Monokai, Cyber Light, and High Contrast.
* 📊 **Saved Sessions Dashboard**: Manage, search, open, or delete past saved rooms from a MongoDB-connected dashboard gallery.
* 🍴 **Session Forking**: Duplicate any room's multi-file structure into a brand new room under your own account.

---

## 🛠️ Tech Stack

* **Frontend**: HTML5, Vanilla CSS3 Variables, ES6 JavaScript, Monaco Editor CDN, Socket.io Client
* **Backend**: Node.js, Express.js (v5.x), Socket.io, Mongoose
* **Database**: MongoDB Atlas
* **Compiler**: Sandboxed Piston API Engine
* **Signaling**: WebRTC (RTCPeerConnection)

---

## ⚙️ Environment Variables

Create a `.env` file inside your `/server` directory:

```env
PORT=3000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_signature_secret_key
CLIENT_URL=http://localhost:3000
```

---

## 🚀 Local Installation & Setup

### 1. Clone & Setup Directory
Open your terminal in the directory where you want the project:
```bash
git clone https://github.com/YOUR_USERNAME/CollabCode.git
cd CollabCode
```

### 2. Install Server Dependencies
```bash
cd server
npm install
```

### 3. Run the App!
Start the server in development mode (using nodemon):
```bash
npm run dev
```

The terminal will print:
```text
✅ MongoDB connected
✅ Server running on port 3000
```

Open your browser and navigate to **[http://localhost:3000](http://localhost:3000)** to start coding! 🚀
