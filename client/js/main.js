// COLLABCODE CENTRAL UTILS & NAVBAR HANDLER

// Base64 decoding helper for JWT parsing
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

// Check session authentication
function isAuthenticated() {
  const token = localStorage.getItem('collab_token');
  if (!token) return false;
  
  const payload = parseJwt(token);
  if (!payload) return false;
  
  // Check expiration (exp is in seconds)
  const currentTime = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < currentTime) {
    // Expired
    logout();
    return false;
  }
  return true;
}

// Get logged-in user details
function getCurrentUser() {
  if (!isAuthenticated()) return null;
  return {
    username: localStorage.getItem('collab_username') || 'Developer',
    email: localStorage.getItem('collab_email') || ''
  };
}

// Save authentication data
function saveAuthSession(token, username, email = '') {
  localStorage.setItem('collab_token', token);
  localStorage.setItem('collab_username', username);
  localStorage.setItem('collab_email', email);
}

// Perform Logout
function logout() {
  localStorage.removeItem('collab_token');
  localStorage.removeItem('collab_username');
  localStorage.removeItem('collab_email');
  showToast('Logged out successfully', 'success');
  setTimeout(() => {
    window.location.reload();
  }, 1000);
}

// Generate unique 8-character Room ID (e.g. "a3f2b1c9")
function generateRoomId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let roomId = '';
  for (let i = 0; i < 8; i++) {
    roomId += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return roomId;
}

// Copy to Clipboard with Toast Confirmation
function copyToClipboard(text, successMsg = 'Copied to clipboard!') {
  navigator.clipboard.writeText(text).then(() => {
    showToast(successMsg, 'success');
  }).catch(err => {
    showToast('Failed to copy link', 'error');
  });
}

// Dynamic Premium Toast System
function showToast(message, type = 'success') {
  // Check if toast element exists
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  
  // Set styling by type
  if (type === 'error') {
    toast.className = 'toast error';
    toast.innerHTML = `<span style="font-size: 1.1rem; color: #ff1744;">✕</span> ${message}`;
  } else {
    toast.className = 'toast';
    toast.innerHTML = `<span style="font-size: 1.1rem; color: #00e676;">✓</span> ${message}`;
  }
  
  // Show
  toast.classList.add('show');
  
  // Hide after 3.5s
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

// Dynamic Navbar Renderer
function renderNavbar() {
  const navContainer = document.getElementById('navbar-container');
  if (!navContainer) return;
  
  const user = getCurrentUser();
  const isAuth = !!user;
  
  const logoHref = window.location.pathname.includes('/editor') ? '/' : './index.html';
  const loginHref = window.location.pathname.includes('/editor') ? './auth.html' : 'auth.html';
  
  let navHtml = `
    <nav class="navbar">
      <a href="${logoHref}" class="logo">
        <div class="logo-dot"></div>
        COLLAB<span>CODE</span>
      </a>
      <div class="nav-links">
  `;
  
  if (isAuth) {
    const initial = user.username.charAt(0).toUpperCase();
    navHtml += `
      <div class="user-tag">
        <div class="user-tag-avatar">${initial}</div>
        <span>${user.username}</span>
      </div>
      <button class="btn btn-danger" onclick="logout()" style="padding: 0.4rem 1rem; font-size: 0.85rem;">
        Logout
      </button>
    `;
  } else {
    navHtml += `
      <a href="${loginHref}" class="btn btn-secondary" style="padding: 0.4rem 1.1rem; font-size: 0.85rem;">
        Sign In
      </a>
    `;
  }
  
  navHtml += `
      </div>
    </nav>
  `;
  
  navContainer.innerHTML = navHtml;
}

// Run basic initializations
document.addEventListener('DOMContentLoaded', () => {
  renderNavbar();
});
