function renderApp() {
    if (!weatherData) return;

    renderCurrent();
    renderHourly();
    renderDaily();
    updateAura(weatherData.current.weather[0].main);
}

function renderCurrent() {
    const current = weatherData.current;
    els.cityName.textContent = currentCity;
    els.currentDate.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    // Animate Number
    animateValue(els.mainTemp, parseInt(els.mainTemp.textContent) || 0, Math.round(current.temp), 1000);

    els.weatherDesc.textContent = current.weather[0].description;
    els.feelsLike.textContent = `${Math.round(current.feels_like)}°`;
    els.humidity.textContent = `${current.humidity}%`;
    els.windSpeed.textContent = `${Math.round(current.wind_speed)} ${currentUnit === 'metric' ? 'km/h' : 'mph'}`;
    els.uvIndex.textContent = current.uvi;
    els.unitToggle.textContent = currentUnit === 'metric' ? '°C' : '°F';
}

function renderHourly() {
    els.hourlyContainer.innerHTML = '';
    const hours = weatherData.hourly.slice(0, 24);

    hours.forEach(hour => {
        const date = new Date(hour.dt * 1000);
        const time = date.getHours() + ':00';
        const temp = Math.round(hour.temp);

        const el = document.createElement('div');
        el.className = 'flex flex-col items-center gap-2 min-w-[60px]';
        el.innerHTML = `
            <span class="text-sm text-white/60">${time}</span>
            <div class="w-full h-24 flex items-end justify-center relative">
                <div class="w-2 bg-white/20 rounded-t-full" style="height: ${Math.min(temp * 2, 100)}%"></div>
            </div>
            <span class="font-bold">${temp}°</span>
        `;
        els.hourlyContainer.appendChild(el);
    });
}

function renderDaily() {
    els.dailyContainer.innerHTML = '';
    const days = weatherData.daily.slice(0, 7);

    days.forEach(day => {
        const date = new Date(day.dt * 1000);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const min = Math.round(day.temp.min);
        const max = Math.round(day.temp.max);

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
    });
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
    fetchWeather(currentCity);
}

async function handleSearch(query) {
    if (query.length < 3) {
        els.searchResults.classList.add('hidden');
        return;
    }

    if (isDemoMode) {
        // Mock search results for demo
        const mockCities = [
            { name: 'London', country: 'GB' },
            { name: 'New York', country: 'US' },
            { name: 'Tokyo', country: 'JP' },
            { name: 'Paris', country: 'FR' },
            { name: 'Sydney', country: 'AU' }
        ].filter(c => c.name.toLowerCase().includes(query.toLowerCase()));

        els.searchResults.innerHTML = '';
        if (mockCities.length) {
            els.searchResults.classList.remove('hidden');
            mockCities.forEach(city => {
                const div = document.createElement('div');
                div.className = 'p-3 hover:bg-white/10 cursor-pointer transition-colors border-b border-glass-border last:border-0';
                div.textContent = `${city.name}, ${city.country}`;
                div.onclick = () => {
                    currentCity = city.name;
                    els.citySearch.value = '';
                    els.searchResults.classList.add('hidden');
                    fetchWeather(currentCity);
                };
                els.searchResults.appendChild(div);
            });
        }
        return;
    }

    try {
        const res = await fetch(`${GEO_URL}?q=${query}&limit=5&appid=${apiKey}`);
        if (!res.ok) return;
        const data = await res.json();

        els.searchResults.innerHTML = '';
        if (data.length) {
            els.searchResults.classList.remove('hidden');
            data.forEach(city => {
                const div = document.createElement('div');
                div.className = 'p-3 hover:bg-white/10 cursor-pointer transition-colors border-b border-glass-border last:border-0';
                div.textContent = `${city.name}, ${city.country}`;
                div.onclick = () => {
                    currentCity = city.name;
                    els.citySearch.value = '';
                    els.searchResults.classList.add('hidden');
                    fetchWeather(currentCity);
                };
                els.searchResults.appendChild(div);
            });
        }
    } catch (e) {
        console.error('Search error', e);
    }
}

function renderFavorites() {
    const faves = JSON.parse(localStorage.getItem('favorites')) || ['London', 'Tokyo', 'New York'];

    els.favoritesList.innerHTML = '';

    // Add Favorite Button
    const addBtn = document.createElement('button');
    addBtn.className = 'text-xs bg-neon-accent text-black font-bold px-3 py-1 rounded-full hover:bg-white transition-colors';
    addBtn.textContent = '+';
    addBtn.title = 'Add current city to favorites';
    addBtn.onclick = addToFavorites;
    els.favoritesList.appendChild(addBtn);

    faves.forEach(city => {
        const btn = document.createElement('button');
        btn.className = 'text-xs bg-glass border border-glass-border px-3 py-1 rounded-full hover:bg-white/20 transition-colors';
        btn.textContent = city;
        btn.onclick = () => {
            currentCity = city;
            fetchWeather(city);
        };
        // Right click to remove
        btn.oncontextmenu = (e) => {
            e.preventDefault();
            removeFromFavorites(city);
        };
        els.favoritesList.appendChild(btn);
    });
}

function addToFavorites() {
    let faves = JSON.parse(localStorage.getItem('favorites')) || [];
    if (!faves.includes(currentCity)) {
        if (faves.length >= 5) faves.shift(); // Keep max 5
        faves.push(currentCity);
        localStorage.setItem('favorites', JSON.stringify(faves));
        renderFavorites();
    }
}

function removeFromFavorites(city) {
    let faves = JSON.parse(localStorage.getItem('favorites')) || [];
    faves = faves.filter(c => c !== city);
    localStorage.setItem('favorites', JSON.stringify(faves));
    renderFavorites();
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
            this.size = Math.random() * 150 + 50; // Large, soft blobs
            this.speedX = (Math.random() - 0.5) * 0.2;
            this.speedY = (Math.random() - 0.5) * 0.2;
            this.alpha = Math.random() * 0.1;
            this.color = this.getColor();
        }
        getColor() {
            const colors = {
                'default': ['#ffffff', '#888888'],
                'Clear': ['#FFD700', '#FFA500', '#00BFFF'], // Sun/Blue
                'Clouds': ['#B0C4DE', '#778899', '#F0F8FF'], // Grey/Blue
                'Rain': ['#00008B', '#4B0082', '#00BFFF'], // Deep Blue/Purple
                'Snow': ['#FFFFFF', '#F0FFFF', '#E0FFFF'], // White/Cyan
                'Thunderstorm': ['#4B0082', '#800080', '#FFD700'], // Purple/Gold
                'Drizzle': ['#ADD8E6', '#87CEEB'],
                'Mist': ['#D3D3D3', '#C0C0C0']
            };
            const palette = colors[auraMode] || colors['default'];
            return palette[Math.floor(Math.random() * palette.length)];
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;

            // Wrap around
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

    // Create fewer, larger particles for "Aura" feel
    auraParticles = [];
    for (let i = 0; i < 20; i++) auraParticles.push(new Particle());

    function animate() {
        ctx.clearRect(0, 0, els.auraCanvas.width, els.auraCanvas.height);
        // Composite operation for blending
        ctx.globalCompositeOperation = 'screen';

        auraParticles.forEach(p => {
            p.update();
            p.draw();
        });

        // Add subtle noise overlay
        // (Optional: could be performance heavy, skipping for now to ensure 60fps)

        requestAnimationFrame(animate);
    }
    animate();
}

function updateAura(condition) {
    console.log('Updating Aura for:', condition);
    auraMode = condition;
    // Gently reset particles to new colors over time or immediately
    auraParticles.forEach(p => {
        p.color = p.getColor();
    });
}

// --- Mock Data for Demo ---
function simulateData(city) {
    console.log('Simulating data for', city);
    weatherData = {
        current: {
            temp: 22,
            feels_like: 24,
            humidity: 60,
            wind_speed: 12,
            uvi: 5,
            weather: [{ main: 'Clear', description: 'clear sky' }]
        },
        hourly: Array(24).fill(0).map((_, i) => ({
            dt: Date.now() / 1000 + i * 3600,
            temp: 20 + Math.random() * 5
        })),
        daily: Array(7).fill(0).map((_, i) => ({
            dt: Date.now() / 1000 + i * 86400,
            temp: { min: 15, max: 25 }
        }))
    };
    renderApp();
}

// Start
init();
