import express from 'express';
import { stringify } from 'querystring';
import { join } from 'path';

const app = express();
const port = 3000;

// Spotify credentials (replace with your own)
const CLIENT_ID = Bun.env.CLIENT_ID;
const CLIENT_SECRET = Bun.env.CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/callback';
const scopes = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-read-private' // Added for playlist access
].join(' ');

// Store tokens
let accessToken = '';
let refreshToken = '';

// Serve static files from 'public' directory
app.use(express.static(join(__dirname, 'public')));

// 1. Root route to serve login page (before auth) or home page (after auth)
app.get('/', (req, res) => {
  if (!accessToken) {
    res.sendFile(join(__dirname, 'public', 'index.html')); // Login page
  } else {
    res.sendFile(join(__dirname, 'public', 'home.html')); // Home page after auth
  }
});

// 2. Route to initiate Spotify login
app.get('/login', (req, res) => {
  const authUrl = `https://accounts.spotify.com/authorize?` +
    stringify({
      response_type: 'code',
      client_id: CLIENT_ID,
      scope: scopes,
      redirect_uri: REDIRECT_URI,
    });
  res.redirect(authUrl);
});

// 3. Callback route to handle Spotify authorization code
app.get('/callback', async (req, res) => {
  const code = req.query.code || null;

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
      },
      body: stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const data = await response.json();
    accessToken = data.access_token;
    refreshToken = data.refresh_token;
    res.redirect('/home.html'); // Redirect to home page after auth
  } catch (error) {
    console.error('Error during token exchange:', error);
    res.status(500).send('Authorization failed');
  }
});

// 4. Refresh token function
async function refreshAccessToken() {
  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
      },
      body: stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
    const data = await response.json();
    accessToken = data.access_token;
    console.log('Token refreshed successfully');
  } catch (error) {
    console.error('Error refreshing token:', error);
  }
}

// Middleware to check token
async function checkToken(req, res, next) {
  if (!accessToken) {
    return res.redirect('/'); // Redirect to login if not authenticated
  }
  next();
}

// 5. Get currently playing song
app.get('/current-song', checkToken, async (req, res) => {
  try {
    const response = await fetch('https://api.spotify.com/v1/me/player', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.status === 204 || !response.ok) {
      console.log('No song playing or error, returning default response');
      return res.json({ title: 'No song playing', artist: '', album: '', image: '', progress: 0, duration: 0 });
    }

    const data = await response.json();
    const { item, progress_ms, duration_ms } = data;
    const songInfo = {
      title: item.name,
      artist: item.artists.map(artist => artist.name).join(', '),
      album: item.album.name,
      image: item.album.images[0]?.url || '',
      progress: Math.floor(progress_ms / 1000),
      duration: Math.floor(duration_ms / 1000),
    };
    res.json(songInfo);
  } catch (error) {
    if (error.message.includes('401')) {
      console.log('Token expired, refreshing...');
      await refreshAccessToken();
      return res.redirect(req.originalUrl); // Retry after refresh
    }
    res.status(500).send('Error fetching current song');
  }
});

// 6. Playback controls
app.get('/play', checkToken, async (req, res) => {
  try {
    await fetch('https://api.spotify.com/v1/me/player/play', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    res.send('Playback started');
  } catch (error) {
    res.status(500).send('Error starting playback');
  }
});

app.get('/pause', checkToken, async (req, res) => {
  try {
    await fetch('https://api.spotify.com/v1/me/player/pause', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    res.send('Playback paused');
  } catch (error) {
    res.status(500).send('Error pausing playback');
  }
});

app.get('/next', checkToken, async (req, res) => {
  try {
    await fetch('https://api.spotify.com/v1/me/player/next', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    res.send('Skipped to next track');
  } catch (error) {
    res.status(500).send('Error skipping to next track');
  }
});

app.get('/previous', checkToken, async (req, res) => {
  try {
    await fetch('https://api.spotify.com/v1/me/player/previous', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    res.send('Skipped to previous track');
  } catch (error) {
    res.status(500).send('Error skipping to previous track');
  }
});

app.get('/shuffle', checkToken, async (req, res) => {
  try {
    await fetch('https://api.spotify.com/v1/me/player/shuffle?state=true', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    res.send('Shuffle enabled');
  } catch (error) {
    res.status(500).send('Error enabling shuffle');
  }
});

// 7. Toggle repeat mode
app.get('/repeat', checkToken, async (req, res) => {
  try {
    // Get current repeat state (optional, for cycling states)
    const playerState = await fetch('https://api.spotify.com/v1/me/player', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const playerData = await playerState.json();
    let currentState = playerData.repeat_state || 'off'; // Default to 'off' if not set

    // Cycle through states: off -> context -> track -> off
    let newState = 'off';
    if (currentState === 'off') newState = 'context';
    else if (currentState === 'context') newState = 'track';
    else if (currentState === 'track') newState = 'off';

    await fetch(`https://api.spotify.com/v1/me/player/repeat?state=${newState}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    res.send(`Repeat mode set to ${newState}`);
  } catch (error) {
    res.status(500).send('Error toggling repeat mode');
  }
});

// 8. Fetch user's playlists
app.get('/user-playlists', checkToken, async (req, res) => {
  try {
    const response = await fetch('https://api.spotify.com/v1/me/playlists', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const playlists = data.items.map(playlist => ({
      id: playlist.id,
      name: playlist.name,
      description: playlist.description || 'No description',
      image: playlist.images[0]?.url || '',
    }));
    res.json(playlists);
  } catch (error) {
    console.error('Error fetching playlists:', error);
    res.status(500).send('Error fetching user playlists');
  }
});

// 9. Fetch user's playback queue
app.get('/queue', checkToken, async (req, res) => {
  try {
    const response = await fetch('https://api.spotify.com/v1/me/player/queue', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const queue = data.queue.map(track => ({
      id: track.id,
      name: track.name,
      artist: track.artists.map(artist => artist.name).join(', '),
      album: track.album.name,
      image: track.album.images[0]?.url || '',
    }));
    res.json(queue);
  } catch (error) {
    console.error('Error fetching queue:', error);
    if (error.message.includes('401')) {
      console.log('Token expired, refreshing...');
      await refreshAccessToken();
      return res.redirect(req.originalUrl); // Retry after refresh
    }
    res.status(500).send('Error fetching queue');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});