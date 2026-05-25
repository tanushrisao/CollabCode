// COLLABCODE PRO - SESSIONS GALLERY DASHBOARD CONTROLLER

let savedSessions = []; // Local cache to support high-speed live search filtering

document.addEventListener('DOMContentLoaded', () => {
  // 1. Enforce authentication check
  if (!isAuthenticated()) {
    sessionStorage.setItem('redirect_room_id', 'dashboard');
    showToast('Please sign in to view your saved workspaces dashboard', 'error');
    setTimeout(() => {
      window.location.href = './auth.html';
    }, 1200);
    return;
  }

  const searchInput = document.getElementById('search-input');
  
  // Fetch initial list from MongoDB
  fetchSavedWorkspaces();

  // Instant real-time live search filter listener
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase().trim();
      filterAndRenderWorkspaces(query);
    });
  }
});

// FETCH SESSIONS FROM DATABASE
async function fetchSavedWorkspaces() {
  const token = localStorage.getItem('collab_token');
  const grid = document.getElementById('sessions-grid');
  const countLabel = document.getElementById('sessions-count');

  try {
    const response = await fetch('/api/sessions/my-sessions', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      savedSessions = await response.json();
      
      // Update count label
      if (countLabel) {
        countLabel.textContent = `${savedSessions.length} Workspaces`;
      }

      renderWorkspacesGrid(savedSessions);
    } else {
      if (grid) {
        grid.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 4rem 2rem; color: var(--accent-red);">
            ⚠️ Failed to retrieve workspaces from database. Please reload and try again.
          </div>
        `;
      }
    }
  } catch (err) {
    console.error('Error fetching database sessions:', err);
    
    // Mock local caching fallback (for local testing verification)
    setTimeout(() => {
      savedSessions = [];
      // Read all keys in localStorage matching room files
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('mock_room_') && !key.endsWith('_temp')) {
          try {
            const data = JSON.parse(localStorage.getItem(key));
            const roomId = key.replace('mock_room_', '');
            
            // Collect languages
            let lang = 'javascript';
            if (data.files) {
              const active = data.activeFile || Object.keys(data.files)[0];
              lang = data.files[active].language;
            } else if (data.language) {
              lang = data.language;
            }

            savedSessions.push({
              roomId: roomId,
              title: data.title || `Mock Room ${roomId.substring(0,4)}`,
              language: lang,
              updatedAt: new Date(data.timestamp || Date.now()).toISOString()
            });
          } catch(e){}
        }
      }

      if (countLabel) {
        countLabel.textContent = `[Mock] ${savedSessions.length} Workspaces`;
      }
      renderWorkspacesGrid(savedSessions);
    }, 800);
  }
}

// RENDER CARDS GRID
function renderWorkspacesGrid(sessionsList) {
  const grid = document.getElementById('sessions-grid');
  const placeholder = document.getElementById('loading-placeholder');
  
  if (!grid) return;
  if (placeholder) placeholder.remove();

  grid.innerHTML = '';

  if (sessionsList.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 5rem 2rem; color: var(--text-secondary); font-family: var(--font-sans);">
        <span style="font-size: 3rem; display: block; margin-bottom: 1rem;">📂</span>
        <h3>No saved workspaces found</h3>
        <p style="font-size: 0.9rem; color: var(--text-muted); margin-top: 0.5rem; margin-bottom: 2rem;">
          Rooms you create and save using the "Save" button will appear here!
        </p>
        <a href="./index.html" class="btn btn-primary" style="padding: 0.6rem 1.5rem;">Create a New Room</a>
      </div>
    `;
    return;
  }

  sessionsList.forEach(session => {
    const card = document.createElement('article');
    card.id = `session-card-${session.roomId}`;
    card.className = 'dashboard-card glass-panel';

    const dateStr = new Date(session.updatedAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    // Determine language file badge
    const languageLabel = (session.language || 'javascript').toUpperCase();

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <h2 class="dashboard-card-title">${session.title || 'Untitled Session'}</h2>
        <span class="dashboard-card-badge">${languageLabel}</span>
      </div>
      <p style="color: var(--text-secondary); font-size: 0.85rem; font-family: var(--font-mono);">
        ID: ${session.roomId}
      </p>
      <div class="dashboard-card-meta">
        <span>📅 ${dateStr}</span>
        <span>👥 Active Room</span>
      </div>
      <div class="dashboard-card-actions">
        <button class="btn btn-secondary btn-danger" onclick="deleteWorkspaceSession('${session.roomId}')" style="padding: 0.4rem 0.8rem; font-size: 0.82rem;" title="Delete this session from database">
          🗑️ Delete
        </button>
        <a href="./editor.html?room=${session.roomId}" class="btn btn-primary" style="padding: 0.4rem 1.1rem; font-size: 0.82rem;" title="Open this collaborative room">
          🚀 Open Room
        </a>
      </div>
    `;

    grid.appendChild(card);
  });
}

// CLIENT-SIDE REAL-TIME SEARCH FILTER
function filterAndRenderWorkspaces(query) {
  if (query === '') {
    renderWorkspacesGrid(savedSessions);
    return;
  }

  const filtered = savedSessions.filter(s => {
    const titleMatch = (s.title || '').toLowerCase().includes(query);
    const roomMatch = (s.roomId || '').toLowerCase().includes(query);
    const langMatch = (s.language || '').toLowerCase().includes(query);
    return titleMatch || roomMatch || langMatch;
  });

  renderWorkspacesGrid(filtered);
}

// DELETE A SAVED WORKSPACE SESSION
async function deleteWorkspaceSession(roomId) {
  if (!confirm(`Are you sure you want to permanently delete session "${roomId}"?`)) return;

  const token = localStorage.getItem('collab_token');
  const card = document.getElementById(`session-card-${roomId}`);
  const countLabel = document.getElementById('sessions-count');

  try {
    const response = await fetch(`/api/sessions/delete/${roomId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      showToast('Workspace session deleted successfully!', 'success');
      
      // Update local array cache
      savedSessions = savedSessions.filter(s => s.roomId !== roomId);

      // Remove card visually
      if (card) {
        card.style.transform = 'scale(0.8)';
        card.style.opacity = '0';
        setTimeout(() => {
          card.remove();
          
          // Render grid again if empty
          if (savedSessions.length === 0) {
            renderWorkspacesGrid(savedSessions);
          }
        }, 300);
      }

      // Update count label
      if (countLabel) {
        countLabel.textContent = `${savedSessions.length} Workspaces`;
      }
    } else {
      const result = await response.json();
      showToast(result.message || 'Failed to delete workspace', 'error');
    }
  } catch (err) {
    console.warn('Backend delete failed. Deleting locally...', err);
    
    // Mock local deletion fallback
    setTimeout(() => {
      localStorage.removeItem(`mock_room_${roomId}`);
      localStorage.removeItem(`mock_room_${roomId}_temp`);
      
      showToast('[Mock Connected] Workspace removed from device!', 'success');
      savedSessions = savedSessions.filter(s => s.roomId !== roomId);

      if (card) {
        card.style.transform = 'scale(0.8)';
        card.style.opacity = '0';
        setTimeout(() => {
          card.remove();
          if (savedSessions.length === 0) {
            renderWorkspacesGrid(savedSessions);
          }
        }, 300);
      }

      if (countLabel) {
        countLabel.textContent = `[Mock] ${savedSessions.length} Workspaces`;
      }
    }, 600);
  }
}
