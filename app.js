// app.js

// --- Configuration ---
const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast';
const GEO_API_URL = 'https://geocoding-api.open-meteo.com/v1/search';

// --- State ---
let currentUnit = 'metric'; // 'metric' (C) or 'imperial' (F)
let currentCity = localStorage.getItem('lastCity') || 'Berlin';
let currentLat = localStorage.getItem('lastLat') || 52.52;
let currentLon = localStorage.getItem('lastLon') || 13.41;
let weatherData = null;

// --- DOM Elements ---
const els = {
    citySearch: document.getElementById('city-search'),
    searchResults: document.getElementById('search-results'),
    unitToggle: document.getElementById('unit-toggle'),
    cityName: document.getElementById('city-name'),
    currentDate: document.getElementById('current-date'),
    mainTemp: document.getElementById('main-temp'),
    weatherDesc: document.getElementById('weather-desc'),
    feelsLike: document.getElementById('feels-like'),
    humidity: document.getElementById('humidity'),
    windSpeed: document.getElementById('wind-speed'),
    uvIndex: document.getElementById('uv-index'),
    hourlyContainer: document.getElementById('hourly-container'),
    dailyContainer: document.getElementById('daily-container'),
    auraCanvas: document.getElementById('aura-canvas'),
    body: document.body,
    favoritesList: document.getElementById('favorites-list')
};

// --- Initialization ---
function init() {
    setupEventListeners();
    initAura();
    renderFavorites();

    // Try to get user location first
    getUserLocation();
}

// --- Geolocation ---
function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                // Try to get city name
                const cityName = await getCityNameFromCoords(latitude, longitude);
                fetchWeather(latitude, longitude, cityName);
            },
            (error) => {
                console.warn('Geolocation denied or error:', error);
                // Fallback to last saved or default
                fetchWeather(currentLat, currentLon, currentCity);
            }
        );
    } else {
        // Fallback if not supported
        fetchWeather(currentLat, currentLon, currentCity);
    }
}

async function getCityNameFromCoords(lat, lon) {
    try {
        const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
        const data = await res.json();
        return data.city || data.locality || 'Current Location';
    } catch (e) {
        console.error('Reverse geocoding failed', e);
        return 'Current Location';
    }
}

// --- Event Listeners ---
function setupEventListeners() {
    // Search
    els.citySearch.addEventListener('focus', () => els.body.classList.add('search-focused'));
    els.citySearch.addEventListener('blur', () => setTimeout(() => els.body.classList.remove('search-focused'), 200));

    let debounceTimer;
    els.citySearch.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => handleSearch(e.target.value), 500);
    });

    // Unit Toggle
    els.unitToggle.addEventListener('click', toggleUnits);
}

// --- API Calls ---
async function fetchWeather(lat, lon, name) {
    try {
        currentCity = name;
        currentLat = lat;
        currentLon = lon;
        localStorage.setItem('lastCity', currentCity);
        localStorage.setItem('lastLat', currentLat);
        localStorage.setItem('lastLon', currentLon);

        const units = currentUnit === 'metric' ? 'celsius' : 'fahrenheit';
        const windUnits = currentUnit === 'metric' ? 'kmh' : 'mph';

        const url = `${WEATHER_API_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=${units}&wind_speed_unit=${windUnits}&timezone=auto`;

        const res = await fetch(url);
        if (!res.ok) throw new Error('Weather fetch failed');

        weatherData = await res.json();
        renderApp();

    } catch (error) {
        console.error('Error fetching weather:', error);
        alert('Failed to fetch weather data.');
    }
}

async function handleSearch(query) {
    if (query.length < 3) {
        els.searchResults.classList.add('hidden');
        return;
    }

    try {
        const res = await fetch(`${GEO_API_URL}?name=${query}&count=5&language=en&format=json`);
        const data = await res.json();

        els.searchResults.innerHTML = '';
        if (data.results && data.results.length) {
            els.searchResults.classList.remove('hidden');
            data.results.forEach(city => {
                const div = document.createElement('div');
                div.className = 'p-3 hover:bg-white/10 cursor-pointer transition-colors border-b border-glass-border last:border-0';
                div.textContent = `${city.name}, ${city.country || ''} ${city.admin1 ? '(' + city.admin1 + ')' : ''}`;
                div.onclick = () => {
                    els.citySearch.value = '';
                    els.searchResults.classList.add('hidden');
                    fetchWeather(city.latitude, city.longitude, city.name);
                };
                els.searchResults.appendChild(div);
            });
        }
    } catch (e) {
        console.error('Search error', e);
    }
}

// --- Rendering ---
function renderApp() {
    if (!weatherData) return;

    renderCurrent();
    renderHourly();
    renderDaily();
    updateAura(getWeatherCondition(weatherData.current.weather_code));
}

function renderCurrent() {
    const current = weatherData.current;
    els.cityName.textContent = currentCity;
    els.currentDate.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    // Animate Number
    animateValue(els.mainTemp, parseInt(els.mainTemp.textContent) || 0, Math.round(current.temperature_2m), 1000);

    els.weatherDesc.textContent = getWeatherDescription(current.weather_code);
    els.feelsLike.textContent = `${Math.round(current.apparent_temperature)}°`;
    els.humidity.textContent = `${current.relative_humidity_2m}%`;
    els.windSpeed.textContent = `${Math.round(current.wind_speed_10m)} ${currentUnit === 'metric' ? 'km/h' : 'mph'}`;
    els.uvIndex.textContent = '-'; // Open-Meteo UV requires separate call, skipping for simplicity or adding later
    els.unitToggle.textContent = currentUnit === 'metric' ? '°C' : '°F';
}

function renderHourly() {
    els.hourlyContainer.innerHTML = '';
    const hourly = weatherData.hourly;
    // Get next 24 hours starting from now
    const currentHourIndex = new Date().getHours();

    for (let i = 0; i < 24; i++) {
        const index = currentHourIndex + i;
        if (index >= hourly.time.length) break;

        const timeStr = hourly.time[index];
        const date = new Date(timeStr);
        const time = date.getHours() + ':00';
        const temp = Math.round(hourly.temperature_2m[index]);

        const el = document.createElement('div');
        el.className = 'flex flex-col items-center gap-2 min-w-[60px]';
        el.innerHTML = `
            <span class="text-sm text-white/60">${time}</span>
            <div class="w-full h-24 flex items-end justify-center relative">
                <div class="w-2 bg-white/20 rounded-t-full" style="height: ${Math.min(temp * 2 + 20, 100)}%"></div>
            </div>
            <span class="font-bold">${temp}°</span>
        `;
        els.hourlyContainer.appendChild(el);
    }
}

function renderDaily() {
    els.dailyContainer.innerHTML = '';
    const daily = weatherData.daily;

    for (let i = 0; i < 7; i++) {
        if (!daily.time[i]) break;

        const date = new Date(daily.time[i]);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const min = Math.round(daily.temperature_2m_min[i]);
        const max = Math.round(daily.temperature_2m_max[i]);

        const el = document.createElement('div');
        el.className = 'daily-row flex justify-between items-center p-4 rounded-xl cursor-default';
        el.innerHTML = `
            <span class="w-16 font-bold">${dayName}</span>
            <div class="flex-1 mx-4 h-1 bg-white/10 rounded-full overflow-hidden">
                <div class="h-full bg-gradient-to-r from-neon-accent to-purple-500 opacity-50" style="width: ${Math.random() * 50 + 20}%"></div>
            </div>
            <div class="flex gap-4 w-24 justify-end">
                <span class="text-white/60">${min}°</span>
                <span class="font-bold">${max}°</span>
            </div>
        `;
        els.dailyContainer.appendChild(el);
    }
}

// --- Helpers ---
function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerHTML = end;
        }
    };
    window.requestAnimationFrame(step);
}

function toggleUnits() {
    currentUnit = currentUnit === 'metric' ? 'imperial' : 'metric';
    fetchWeather(currentLat, currentLon, currentCity);
}

function renderFavorites() {
    const faves = JSON.parse(localStorage.getItem('favorites')) || [];

    els.favoritesList.innerHTML = '';

    // Add Favorite Button
    const addBtn = document.createElement('button');
    addBtn.className = 'text-xs bg-neon-accent text-black font-bold px-3 py-1 rounded-full hover:bg-white transition-colors';
    addBtn.textContent = '+';
    addBtn.title = 'Add current city to favorites';
    addBtn.onclick = addToFavorites;
    els.favoritesList.appendChild(addBtn);

    faves.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'text-xs bg-glass border border-glass-border px-3 py-1 rounded-full hover:bg-white/20 transition-colors';
        btn.textContent = item.name;
        btn.onclick = () => {
            fetchWeather(item.lat, item.lon, item.name);
        };
        // Right click to remove
        btn.oncontextmenu = (e) => {
            e.preventDefault();
            removeFromFavorites(item.name);
        };
        els.favoritesList.appendChild(btn);
    });
}

function addToFavorites() {
    let faves = JSON.parse(localStorage.getItem('favorites')) || [];
    // Check if already exists
    if (!faves.some(f => f.name === currentCity)) {
        if (faves.length >= 5) faves.shift();
        faves.push({ name: currentCity, lat: currentLat, lon: currentLon });
        localStorage.setItem('favorites', JSON.stringify(faves));
        renderFavorites();
    }
}

function removeFromFavorites(cityName) {
    let faves = JSON.parse(localStorage.getItem('favorites')) || [];
    faves = faves.filter(c => c.name !== cityName);
    localStorage.setItem('favorites', JSON.stringify(faves));
    renderFavorites();
}

// --- WMO Code Mapping ---
function getWeatherDescription(code) {
    const codes = {
        0: 'Clear sky',
        1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
        45: 'Fog', 48: 'Depositing rime fog',
        51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
        61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
        71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
        77: 'Snow grains',
        80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
        85: 'Slight snow showers', 86: 'Heavy snow showers',
        95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with heavy hail'
    };
    return codes[code] || 'Unknown';
}

function getWeatherCondition(code) {
    // Maps WMO code to Aura condition
    if (code === 0 || code === 1) return 'Clear';
    if (code === 2 || code === 3 || code === 45 || code === 48) return 'Clouds';
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return 'Rain';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
    if ([95, 96, 99].includes(code)) return 'Thunderstorm';
    return 'default';
}

// --- Aura Effect (Canvas) ---
let auraParticles = [];
let auraMode = 'default';

function initAura() {
    const ctx = els.auraCanvas.getContext('2d');

    function resize() {
        els.auraCanvas.width = window.innerWidth;
        els.auraCanvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    class Particle {
        constructor() {
            this.reset();
        }
        reset() {
            this.x = Math.random() * els.auraCanvas.width;
            this.y = Math.random() * els.auraCanvas.height;
            this.size = Math.random() * 150 + 50;
            this.speedX = (Math.random() - 0.5) * 0.2;
            this.speedY = (Math.random() - 0.5) * 0.2;
            this.alpha = Math.random() * 0.1;
            this.color = this.getColor();
        }
        getColor() {
            const colors = {
                'default': ['#ffffff', '#888888'],
                'Clear': ['#FFD700', '#FFA500', '#00BFFF'],
                'Clouds': ['#B0C4DE', '#778899', '#F0F8FF'],
                'Rain': ['#00008B', '#4B0082', '#00BFFF'],
                'Snow': ['#FFFFFF', '#F0FFFF', '#E0FFFF'],
                'Thunderstorm': ['#4B0082', '#800080', '#FFD700']
            };
            const palette = colors[auraMode] || colors['default'];
            return palette[Math.floor(Math.random() * palette.length)];
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            if (this.x < -this.size) this.x = els.auraCanvas.width + this.size;
            if (this.x > els.auraCanvas.width + this.size) this.x = -this.size;
            if (this.y < -this.size) this.y = els.auraCanvas.height + this.size;
            if (this.y > els.auraCanvas.height + this.size) this.y = -this.size;
        }
        draw() {
            const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
            gradient.addColorStop(0, this.color);
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = this.alpha;
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }
    }

    auraParticles = [];
    for (let i = 0; i < 20; i++) auraParticles.push(new Particle());

    function animate() {
        ctx.clearRect(0, 0, els.auraCanvas.width, els.auraCanvas.height);
        ctx.globalCompositeOperation = 'screen';
        auraParticles.forEach(p => {
            p.update();
            p.draw();
        });
        requestAnimationFrame(animate);
    }
    animate();
}

function updateAura(condition) {
    if (auraMode === condition) return;
    console.log('Updating Aura for:', condition);
    auraMode = condition;
    auraParticles.forEach(p => {
        p.color = p.getColor();
    });
}

// Start
init();
