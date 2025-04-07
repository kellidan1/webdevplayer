// Elements
const buttons = document.querySelectorAll('.menu-button');
const contentWrapper = document.getElementById('content-wrapper');
const songTitle = document.querySelector('.song-title');
const songArtist = document.querySelector('.song-artist');
const progress = document.querySelector('.progress');
const currentTimeEl = document.querySelector('.current-time');
const durationEl = document.querySelector('.duration');
const vinyl = document.querySelector('.cd');

// Menu button toggle and content switch
buttons.forEach(button => {
    button.addEventListener('click', function () {
        document.querySelector('.menu-button.active')?.classList.remove('active');
        this.classList.add('active');

        const section = this.getAttribute('data-section');
        if (section === 'library') {
            fetchPlaylists();
        } else if (section === 'queue') {
            // Placeholder for queue content (empty boxes for now)
            contentWrapper.innerHTML = Array(8).fill().map(() => '<div class="box"></div>').join('') + '<div class="close-btn">X</div>';
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
        durationEl.textContent = formatTime(data.duration);
        updateProgress(data.progress, data.duration);
        if (data.image) {
            vinyl.src = data.image; // Use album-art for the image
            vinyl.style.display = 'block';
        } else {
            vinyl.style.display = 'none';
            vinyl.style.display = 'block'; // Show default vinyl if no image
        }
    } catch (error) {
        console.error('Error fetching song:', error);
        songTitle.textContent = 'Error';
        songArtist.textContent = 'Could not load song';
        vinyl.style.display = 'none';
        vinyl.style.display = 'block'; // Show default vinyl on error
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
        vinyl.style.transform = `rotate(${rotation}deg)`; // Sync album art rotation
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

document.getElementById('play').addEventListener('click', () => {
    fetch('/play', { method: 'GET' })
        .then(response => response.text())
        .then(message => console.log(message))
        .catch(error => console.error('Error starting playback:', error))
        .finally(() => fetchCurrentSong());
});

document.getElementById('next').addEventListener('click', () => {
    fetch('/next', { method: 'GET' })
        .then(response => response.text())
        .then(message => console.log(message))
        .catch(error => console.error('Error skipping to next:', error))
        .finally(() => fetchCurrentSong());
});

document.getElementById('repeat').addEventListener('click', () => {
    fetch('/repeat', { method: 'GET' })
        .then(response => response.text())
        .then(message => {
            console.log(message); // Log the repeat state (e.g., "Repeat mode set to context")
            fetchCurrentSong(); // Refresh song info
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

// Poll song info every 1 second
fetchCurrentSong();
setInterval(fetchCurrentSong, 1000);

// Initial load (set to Queue by default)
buttons[0].click(); // Simulate click on "Queue" to initialize