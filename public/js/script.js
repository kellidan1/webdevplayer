// Elements
const buttons = document.querySelectorAll('.menu-button');
const contentWrapper = document.getElementById('content-wrapper');
const songTitle = document.querySelector('.song-title');
const songArtist = document.querySelector('.song-artist');
const progress = document.querySelector('.progress');
const currentTimeEl = document.querySelector('.current-time');
const durationEl = document.querySelector('.duration');
const vinyl = document.querySelector('.cd');
const playButton = document.getElementById('play');
let isPlaying = false; // Track playback state

// Menu button toggle and content switch
buttons.forEach(button => {
    button.addEventListener('click', function () {
        document.querySelector('.menu-button.active')?.classList.remove('active');
        this.classList.add('active');

        const section = this.getAttribute('data-section');
        if (section === 'library') {
            fetchPlaylists();
        } else if (section === 'queue') {
            fetchQueue();
        }
    });
});

// Fetch current song from backend
async function fetchCurrentSong() {
    try {
        const response = await fetch('/current-song');
        const data = await response.json();
        songTitle.textContent = data.title;
        songArtist.textContent = data.artist;
        console.log(data.duration, durationEl)
        durationEl.textContent = formatTime(data.duration);
        updateProgress(data.progress, data.duration);
        vinyl.src = data.image ?? 'images/default_disc_cover.png';
        // Update playback state if provided by backend
        if (typeof data.is_playing === 'boolean') {
            isPlaying = data.is_playing;
            playButton.classList.toggle('fa-play', !isPlaying);
            playButton.classList.toggle('fa-pause', isPlaying);
        }
    } catch (error) {
        console.error('Error fetching song:', error);
        songTitle.textContent = 'Error';
        songArtist.textContent = 'Could not load song';
    }
}

// Update progress bar and time
function updateProgress(currentTime, duration) {
    progress.style.width = (currentTime / duration) * 100 + '%';
    currentTimeEl.textContent = formatTime(currentTime);
}

// Format time in MM:SS
function formatTime(sec) {
    const minutes = Math.floor(sec / 60);
    const seconds = sec % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

// Vinyl and album art animation
let startTime = null;
function animateVinyl(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = (timestamp - startTime) / 1000; // seconds
    const rotation = (elapsed % 10) * 36; // Full rotation every 10 seconds
    vinyl.style.transform = `rotate(${rotation}deg)`;
    if (vinyl.style.display !== 'none') {
        vinyl.style.transform = `rotate(${rotation}deg)`;
    }
    requestAnimationFrame(animateVinyl);
}
requestAnimationFrame(animateVinyl);

// Control button handlers with API calls
document.getElementById('shuffle').addEventListener('click', () => {
    fetch('/shuffle', { method: 'GET' })
        .then(response => response.text())
        .then(message => console.log(message))
        .catch(error => console.error('Error enabling shuffle:', error))
        .finally(() => fetchCurrentSong());
});

document.getElementById('previous').addEventListener('click', () => {
    fetch('/previous', { method: 'GET' })
        .then(response => response.text())
        .then(message => console.log(message))
        .catch(error => console.error('Error skipping to previous:', error))
        .finally(() => fetchCurrentSong());
});

playButton.addEventListener('click', async () => {
    try {
        playButton.disabled = true; // Prevent multiple clicks
        if (isPlaying) {
            const response = await fetch('/pause', { method: 'GET' });
            const message = await response.text();
            console.log(message);
            isPlaying = false;
        } else {
            const response = await fetch('/play', { method: 'GET' });
            const message = await response.text();
            console.log(message);
            isPlaying = true;
        }
        playButton.classList.toggle('fa-play', !isPlaying);
        playButton.classList.toggle('fa-pause', isPlaying);
        fetchCurrentSong();
    } catch (error) {
        console.error('Error toggling playback:', error);
        songTitle.textContent = 'Error';
        songArtist.textContent = 'Playback failed';
    } finally {
        playButton.disabled = false;
    }
});

document.getElementById('next').addEventListener('click', () => {
    fetch('/next', { method: 'GET' })
        .then(response => response.text())
        .then(message => {
            console.log(message);
            fetchQueue(); // Refresh queue after next song
            fetchCurrentSong(); // Refresh song info
        })
        .catch(error => console.error('Error skipping to next:', error));
});

document.getElementById('repeat').addEventListener('click', () => {
    fetch('/repeat', { method: 'GET' })
        .then(response => response.text())
        .then(message => {
            console.log(message);
            fetchCurrentSong();
        })
        .catch(error => console.error('Error toggling repeat:', error));
});

// Fetch user's playlists
async function fetchPlaylists() {
    try {
        const response = await fetch('/user-playlists');
        const playlists = await response.json();
        contentWrapper.innerHTML = playlists.map(playlist => `
            <div class="box">
                <img src="${playlist.image || 'images/default-placeholder.png'}" alt="${playlist.name}">
                <span>${playlist.name}</span>
            </div>
        `).join('') + '<div class="close-btn">X</div>';
    } catch (error) {
        console.error('Error fetching playlists:', error);
        contentWrapper.innerHTML = '<div class="box">Failed to load playlists</div><div class="close-btn">X</div>';
    }
}

// Fetch user's playback queue (limited to 8 items)
async function fetchQueue() {
    try {
        const response = await fetch('/queue');
        const queue = await response.json();
        const limitedQueue = queue.slice(0, 8); // Limit to 8 items
        contentWrapper.innerHTML = limitedQueue.map(track => `
            <div class="box">
                <img src="${track.image || 'images/default-placeholder.png'}" alt="${track.name}">
                <span>${track.name} - ${track.artist}</span>
            </div>
        `).join('') + '<div class="close-btn">X</div>';
    } catch (error) {
        console.error('Error fetching queue:', error);
        contentWrapper.innerHTML = '<div class="box">Failed to load queue</div><div class="close-btn">X</div>';
    }
}

// Fetch next song info
async function fetchNextSong() {
    try {
        const response = await fetch('/queue');
        const queue = await response.json();
        // Get the next song (second item in queue, assuming first is current)
        const nextSong = queue[0] || { image: 'images/default_disc_cover.png' };
        return nextSong.image || 'images/default-placeholder.png';
    } catch (error) {
        console.error('Error fetching next song:', error);
        return 'images/default-placeholder.png';
    }
}

// Close button functionality - transform to circle in bottom-left with next song's album art
document.addEventListener('click', async (event) => {
    const sidebar = document.querySelector('.sidebar');
    const menuWrapper = document.querySelector('.menu-wrapper');
    
    if (event.target.className === 'close-btn') {
        const nextSongImage = await fetchNextSong();
        
        // Clear existing content and apply circular styling
        contentWrapper.innerHTML = '';
        sidebar.style.width = '100px'; // Adjust size as needed
        sidebar.style.height = '100px';
        sidebar.style.borderRadius = '50%';
        sidebar.style.backgroundImage = `url(${nextSongImage})`;
        sidebar.style.backgroundSize = 'cover';
        sidebar.style.backgroundPosition = 'center';
        sidebar.style.overflow = 'hidden';
        sidebar.style.position = 'fixed'; // Use fixed to position relative to viewport
        sidebar.style.bottom = '20px'; // Position from bottom
        sidebar.style.left = '20px'; // Position from left
        sidebar.style.top = 'auto'; // Override original top positioning
        sidebar.style.cursor = 'pointer'; // Indicate it's clickable
        sidebar.style.paddingTop = '0'; // Remove original padding
        sidebar.style.paddingLeft = '0';
        sidebar.style.zIndex = '1000'; // Ensure it stays above other elements
        
        // Hide menu buttons
        menuWrapper.style.display = 'none';
    } else if (event.target === sidebar && sidebar.style.borderRadius === '50%') {
        // Reopen sidebar when clicked in circular state
        sidebar.style.width = '20vw'; // Reset to original width from CSS
        sidebar.style.height = '85vh'; // Reset to original height from CSS
        sidebar.style.borderRadius = '10px'; // Reset to original border-radius
        sidebar.style.backgroundImage = '';
        sidebar.style.backgroundSize = '';
        sidebar.style.backgroundPosition = '';
        sidebar.style.overflow = '';
        sidebar.style.position = 'absolute'; // Reset to original positioning
        sidebar.style.bottom = '';
        sidebar.style.left = '0.8vw'; // Reset to original left
        sidebar.style.top = '10vh'; // Reset to original top
        sidebar.style.cursor = '';
        sidebar.style.paddingTop = '10px'; // Restore original padding
        sidebar.style.paddingLeft = '20px';
        sidebar.style.zIndex = ''; // Reset z-index
        
        // Show menu buttons again
        menuWrapper.style.display = '';
        
        // Reload queue or library based on active button
        const activeButton = document.querySelector('.menu-button.active');
        const section = activeButton?.getAttribute('data-section');
        if (section === 'library') {
            fetchPlaylists();
        } else {
            fetchQueue();
        }
    }
});

// Poll song info every 1 second
fetchCurrentSong();
setInterval(fetchCurrentSong, 1000);

// Initial load (set to Queue by default)
buttons[0].click(); // Simulate click on "Queue" to initialize