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
let currentSongKey = null; // To track song changes using title + artist
const needle = document.querySelector('.needle');
let animationActive = false; // Flag to control animation
let lastRotation = 0; // Store the last rotation angle

function moveNeedle(playState) {
    needle.style.transformOrigin = '0% 50%';
    if (playState) {
        needle.style.transform = 'rotate(0deg)'; // Needle on disc (playing), aligned with center
    } else {
        needle.style.transform = 'rotate(-45deg)'; // Needle off disc (paused), lifted upward
    }
    needle.style.transformOrigin = '50% 50%';
}

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
        songTitle.textContent = data.title || 'Unknown';
        songArtist.textContent = data.artist || 'Unknown';
        durationEl.textContent = formatTime(data.duration || 0);
        updateProgress(data.progress || 0, data.duration || 1); // Avoid division by zero
        vinyl.src = data.image ?? 'images/default_disc_cover.png';
        // Update playback state if provided by backend
        if (typeof data.is_playing === 'boolean') {
            isPlaying = data.is_playing;
            playButton.classList.toggle('fa-play', !isPlaying);
            playButton.classList.toggle('fa-pause', isPlaying);
            moveNeedle(isPlaying); // Update needle position based on play state
            if (isPlaying && !animationActive) {
                startAnimation(); // Start animation if not already active
            } else if (!isPlaying && animationActive) {
                stopAnimation(); // Stop animation if active
            }
        }
        // Check if song changed and update sidebar if closed
        const newSongKey = `${data.title}-${data.artist}`; // Unique key for song
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && sidebar.style.borderRadius === '50%' && newSongKey !== currentSongKey) {
            if (data.progress >= (data.duration || 1) - 1) { // Song is done (within 1 second)
                const nextSongImage = await fetchNextSong();
                sidebar.style.backgroundImage = `url(${nextSongImage})`;
                currentSongKey = newSongKey;
            }
        } else if (newSongKey !== currentSongKey) {
            currentSongKey = newSongKey; // Update only if song changes
        }
    } catch (error) {
        console.error('Error fetching song:', error);
        songTitle.textContent = 'Error';
        songArtist.textContent = 'Could not load song';
    }
}

// Update progress bar and time
function updateProgress(currentTime, duration) {
    const width = duration ? (currentTime / duration) * 100 : 0; // Avoid NaN
    progress.style.width = `${width}%`;
    currentTimeEl.textContent = formatTime(currentTime || 0);
}

// Format time in MM:SS
function formatTime(sec) {
    const minutes = Math.floor(sec / 60);
    const seconds = Math.floor(sec % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

// Vinyl and album art animation
let startTime = null;
let animationFrameId = null;

function animateVinyl(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = (timestamp - startTime) / 1000; // seconds
    const rotation = lastRotation + (elapsed % 10) * 36; // Continue from last rotation
    vinyl.style.transform = `rotate(${rotation}deg)`;
    if (vinyl.style.display !== 'none') {
        vinyl.style.transform = `rotate(${rotation}deg)`;
    }
    if (animationActive) {
        animationFrameId = requestAnimationFrame(animateVinyl);
    }
}

function startAnimation() {
    if (!animationActive) {
        animationActive = true;
        // Get the current rotation to continue from it
        const currentTransform = window.getComputedStyle(vinyl).transform;
        if (currentTransform && currentTransform !== 'none') {
            const matrix = new WebKitCSSMatrix(currentTransform);
            lastRotation = Math.round(Math.atan2(matrix.m21, matrix.m11) * (180 / Math.PI));
        }
        startTime = null; // Reset start time for new elapsed calculation
        animationFrameId = requestAnimationFrame(animateVinyl);
    }
}

function stopAnimation() {
    if (animationActive) {
        animationActive = false;
        cancelAnimationFrame(animationFrameId);
        // Preserve the last rotation by not resetting it
        const currentTransform = window.getComputedStyle(vinyl).transform;
        if (currentTransform && currentTransform !== 'none') {
            const matrix = new WebKitCSSMatrix(currentTransform);
            lastRotation = Math.round(Math.atan2(matrix.m21, matrix.m11) * (180 / Math.PI));
        }
    }
}

requestAnimationFrame(animateVinyl); // Initial call to start animation

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
            moveNeedle(false);
            stopAnimation(); // Stop animation when paused
        } else {
            const response = await fetch('/play', { method: 'GET' });
            const message = await response.text();
            console.log(message);
            isPlaying = true;
            moveNeedle(true);
            startAnimation(); // Start animation when played
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

// Add key bindings
document.addEventListener('keydown', (event) => {
    switch (event.key) {
        case ' ':
            event.preventDefault(); // Prevent spacebar from scrolling page
            playButton.click(); // Trigger play/pause
            break;
        case 'ArrowRight':
            document.getElementById('next').click(); // Trigger next
            break;
        case 'ArrowLeft':
            document.getElementById('previous').click(); // Trigger previous
            break;
        case 's':
        case 'S':
            document.getElementById('shuffle').click(); // Trigger shuffle
            break;
        case 'r':
        case 'R':
            document.getElementById('repeat').click(); // Trigger repeat
            break;
        default:
            break;
    }
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
        // Get the next song (first item in queue since current song is playing)
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
    const closeBtn = document.querySelector('.close-btn');
    
    if (event.target.className === 'close-btn') {
        const nextSongImage = await fetchNextSong();
        
        // Clear existing content and remove close button
        if (closeBtn) closeBtn.remove();
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

// Theme button gradient functionality
const themeButton = document.querySelector('.theme-button');
const bg = document.querySelector('.bg');
let currentIndex = 0;
const colors = ['#2A3335', '#0A5EB0', '#0A97B0', '#FFCFEF'];

themeButton.addEventListener('click', () => {
    // Move to the next color index, looping back to 0
    currentIndex = (currentIndex + 1) % colors.length;

    // Apply gradient background using the current and next color
    const nextIndex = (currentIndex + 1) % colors.length;
    bg.style.background = `${colors[nextIndex]}`;
});

// Poll song info every 1 second
fetchCurrentSong();
setInterval(fetchCurrentSong, 1000);

// Initial load (set to Queue by default)
buttons[0].click(); // Simulate click on "Queue" to initialize