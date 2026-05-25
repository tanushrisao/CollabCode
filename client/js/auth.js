// AUTHENTICATION INTERACTION & INTEGRATION
let currentMode = 'login'; // 'login' or 'signup'

document.addEventListener('DOMContentLoaded', () => {
  // Check if already authenticated and redirect
  if (isAuthenticated()) {
    showToast('Already signed in, redirecting...', 'success');
    setTimeout(() => {
      window.location.href = './index.html';
    }, 1200);
    return;
  }

  const loginTabBtn = document.getElementById('tab-login');
  const signupTabBtn = document.getElementById('tab-signup');
  const authForm = document.getElementById('auth-form');
  const emailGroup = document.getElementById('group-email');
  const submitBtn = document.getElementById('btn-submit');
  const formTitle = document.getElementById('auth-card-title');
  const formSubtitle = document.getElementById('auth-card-subtitle');

  if (!loginTabBtn || !signupTabBtn || !authForm) return;

  // Toggle Mode Helper
  const setAuthMode = (mode) => {
    currentMode = mode;
    if (mode === 'signup') {
      loginTabBtn.classList.remove('active');
      signupTabBtn.classList.add('active');
      emailGroup.style.display = 'block';
      emailGroup.querySelector('input').setAttribute('required', 'required');
      formTitle.textContent = 'Create Account';
      formSubtitle.textContent = 'Sign up to start saving your real-time coding sessions';
      submitBtn.textContent = 'Create Free Account';
    } else {
      signupTabBtn.classList.remove('active');
      loginTabBtn.classList.add('active');
      emailGroup.style.display = 'none';
      emailGroup.querySelector('input').removeAttribute('required');
      formTitle.textContent = 'Welcome Back';
      formSubtitle.textContent = 'Sign in to access your saved collaborative workspaces';
      submitBtn.textContent = 'Sign In';
    }
  };

  // Event Listeners for Tabs
  loginTabBtn.addEventListener('click', () => setAuthMode('login'));
  signupTabBtn.addEventListener('click', () => setAuthMode('signup'));

  // Handle Form Submission
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('input-username').value.trim();
    const password = document.getElementById('input-password').value.trim();
    const email = document.getElementById('input-email').value.trim();

    if (!username || !password) {
      showToast('Please fill out all required fields', 'error');
      return;
    }

    if (currentMode === 'signup' && !email) {
      showToast('Please enter an email for registration', 'error');
      return;
    }

    submitBtn.setAttribute('disabled', 'disabled');
    submitBtn.textContent = 'Connecting...';

    // Form data bundle
    const payload = { username, password };
    if (currentMode === 'signup') {
      payload.email = email;
    }

    // Determine target API endpoint
    const endpoint = currentMode === 'signup' ? '/api/auth/register' : '/api/auth/login';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok) {
        // Success
        saveAuthSession(result.token, result.username || username, result.email || email);
        showToast(currentMode === 'signup' ? 'Account created successfully!' : 'Signed in successfully!', 'success');
        
        setTimeout(() => {
          // Go to landing page or editor room
          const redirectRoom = sessionStorage.getItem('redirect_room_id');
          if (redirectRoom) {
            sessionStorage.removeItem('redirect_room_id');
            window.location.href = `./editor.html?room=${redirectRoom}`;
          } else {
            window.location.href = './index.html';
          }
        }, 1200);
      } else {
        // API error
        showToast(result.message || 'Authentication failed', 'error');
        resetSubmitBtn();
      }
    } catch (error) {
      console.warn('Backend API connection failed, executing frontend Mock verification fallback...', error);
      
      // MOCK FALLBACK (so user can instantly test visual interface without a database connection)
      setTimeout(() => {
        // Create a Mock JWT token
        const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
        const currentSecs = Math.floor(Date.now() / 1000);
        const expSecs = currentSecs + (7 * 24 * 60 * 60); // 7 days
        const payloadData = btoa(JSON.stringify({ 
          username, 
          email: email || `${username}@example.com`,
          exp: expSecs 
        }));
        const mockToken = `${header}.${payloadData}.mockSignatureHash`;

        saveAuthSession(mockToken, username, email || `${username}@example.com`);
        showToast(`[Mock Active] Welcome, ${username}!`, 'success');
        
        setTimeout(() => {
          const redirectRoom = sessionStorage.getItem('redirect_room_id');
          if (redirectRoom) {
            sessionStorage.removeItem('redirect_room_id');
            window.location.href = `./editor.html?room=${redirectRoom}`;
          } else {
            window.location.href = './index.html';
          }
        }, 1200);
      }, 1000);
    }
  });

  function resetSubmitBtn() {
    submitBtn.removeAttribute('disabled');
    submitBtn.textContent = currentMode === 'signup' ? 'Create Free Account' : 'Sign In';
  }
});
