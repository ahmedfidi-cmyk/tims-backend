// Weather Dashboard Application
const API_BASE_URL = '/api/weather';
let currentUnit = 'metric';
let currentCity = '';
let currentWeatherData = null;

// DOM Elements
const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const locationBtn = document.getElementById('locationBtn');
const celsiusBtn = document.getElementById('celsiusBtn');
const fahrenheitBtn = document.getElementById('fahrenheitBtn');
const currentWeatherSection = document.getElementById('currentWeather');
const forecastSection = document.getElementById('forecastSection');
const loadingSpinner = document.getElementById('loadingSpinner');
const weatherList = document.getElementById('weatherList');

// Event Listeners
searchBtn.addEventListener('click', () => searchWeather());
cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchWeather();
});
locationBtn.addEventListener('click', getUserLocation);
celsiusBtn.addEventListener('click', () => switchUnit('metric'));
fahrenheitBtn.addEventListener('click', () => switchUnit('imperial'));

// Weather Icon Mapping
const weatherIconMap = {
    '01d': '☀️',
    '01n': '🌙',
    '02d': '⛅',
    '02n': '☁️',
    '03d': '☁️',
    '03n': '☁️',
    '04d': '☁️',
    '04n': '☁️',
    '09d': '🌧️',
    '09n': '🌧️',
    '10d': '🌦️',
    '10n': '🌧️',
    '11d': '⛈️',
    '11n': '⛈️',
    '13d': '❄️',
    '13n': '❄️',
    '50d': '🌫️',
    '50n': '🌫️'
};

// Main Search Function
async function searchWeather() {
    const city = cityInput.value.trim();
    if (!city) {
        showError('Please enter a city name');
        return;
    }

    currentCity = city;
    showLoading(true);

    try {
        const response = await fetch(
            `${API_BASE_URL}/current/city?city=${encodeURIComponent(city)}&units=${currentUnit}`
        );

        if (!response.ok) {
            throw new Error('Weather not found');
        }

        const result = await response.json();
        currentWeatherData = result.data;

        displayWeather(result.data);
        fetchForecast(city);
        loadAllWeather();
        showError('');
    } catch (error) {
        showError('Failed to fetch weather: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Get User Location
function getUserLocation() {
    if (!navigator.geolocation) {
        showError('Geolocation is not supported by your browser');
        return;
    }

    showLoading(true);
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            fetchWeatherByCoordinates(latitude, longitude);
        },
        (error) => {
            showError('Failed to get your location: ' + error.message);
            showLoading(false);
        }
    );
}

// Fetch Weather by Coordinates
async function fetchWeatherByCoordinates(lat, lon) {
    try {
        const response = await fetch(
            `${API_BASE_URL}/current/coordinates?lat=${lat}&lon=${lon}&units=${currentUnit}`
        );

        if (!response.ok) {
            throw new Error('Failed to fetch weather');
        }

        const result = await response.json();
        currentWeatherData = result.data;
        currentCity = result.data.city;
        cityInput.value = currentCity;

        displayWeather(result.data);
        fetchForecast(currentCity);
        loadAllWeather();
        showError('');
    } catch (error) {
        showError('Failed to fetch weather: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Display Weather Data
function displayWeather(data) {
    const unitSymbol = currentUnit === 'metric' ? '°C' : '°F';
    const windUnit = currentUnit === 'metric' ? 'm/s' : 'mph';

    document.getElementById('cityName').textContent = `${data.city}, ${data.country || ''}`;
    document.getElementById('temperature').textContent = `${Math.round(data.temperature)}${unitSymbol}`;
    document.getElementById('description').textContent = data.description || 'N/A';
    document.getElementById('feelsLike').textContent = `Feels like ${Math.round(data.feelsLike)}${unitSymbol}`;
    document.getElementById('humidity').textContent = `${data.humidity || 'N/A'}%`;
    document.getElementById('pressure').textContent = `${data.pressure || 'N/A'} hPa`;
    document.getElementById('windSpeed').textContent = `${data.windSpeed || 'N/A'} ${windUnit}`;
    document.getElementById('visibility').textContent = `${data.visibility ? (data.visibility / 1000).toFixed(1) : 'N/A'} km`;
    document.getElementById('minTemp').textContent = `${Math.round(data.tempMin)}${unitSymbol}`;
    document.getElementById('maxTemp').textContent = `${Math.round(data.tempMax)}${unitSymbol}`;
    document.getElementById('sunrise').textContent = formatTime(new Date(data.sunrise));
    document.getElementById('sunset').textContent = formatTime(new Date(data.sunset));
    document.getElementById('weatherTime').textContent = new Date().toLocaleString();

    // Set weather icon
    const iconCode = getWeatherIconCode(data.weatherMain);
    document.getElementById('weatherIcon').textContent = weatherIconMap[iconCode] || '🌤️';

    currentWeatherSection.classList.remove('hidden');
}

// Fetch Forecast
async function fetchForecast(city) {
    try {
        const response = await fetch(
            `${API_BASE_URL}/forecast?city=${encodeURIComponent(city)}&units=${currentUnit}`
        );

        if (!response.ok) throw new Error('Failed to fetch forecast');

        const result = await response.json();
        displayForecast(result.data);
    } catch (error) {
        console.error('Forecast error:', error);
    }
}

// Display Forecast
function displayForecast(forecastData) {
    const container = document.getElementById('forecastContainer');
    container.innerHTML = '';
    const unitSymbol = currentUnit === 'metric' ? '°C' : '°F';

    // Get one forecast per day (every 8 entries = 24 hours)
    const dailyForecasts = forecastData.list.filter((_, index) => index % 8 === 0);

    dailyForecasts.forEach(forecast => {
        const date = new Date(forecast.dt * 1000);
        const iconCode = forecast.weather[0].icon;
        const icon = weatherIconMap[iconCode] || '🌤️';

        const forecastItem = document.createElement('div');
        forecastItem.className = 'forecast-item';
        forecastItem.innerHTML = `
            <div class="forecast-date">${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
            <div class="forecast-icon">${icon}</div>
            <div class="forecast-temp">${Math.round(forecast.main.temp)}${unitSymbol}</div>
            <div class="forecast-desc">${forecast.weather[0].description}</div>
        `;
        container.appendChild(forecastItem);
    });

    forecastSection.classList.remove('hidden');
}

// Load All Cached Weather
async function loadAllWeather() {
    try {
        const response = await fetch(`${API_BASE_URL}/cached/all`);
        if (!response.ok) throw new Error('Failed to load weather');

        const result = await response.json();
        displayWeatherList(result.data);
    } catch (error) {
        console.error('Error loading all weather:', error);
    }
}

// Display Weather List
function displayWeatherList(cities) {
    weatherList.innerHTML = '';
    const unitSymbol = currentUnit === 'metric' ? '°C' : '°F';

    if (cities.length === 0) {
        weatherList.innerHTML = '<p style="text-align: center; color: #888;">No weather data yet. Search for a city!</p>';
        return;
    }

    cities.forEach(city => {
        const weatherItem = document.createElement('div');
        weatherItem.className = 'weather-item';
        weatherItem.innerHTML = `
            <div class="weather-item-city">${city.city}, ${city.country || ''}</div>
            <div class="weather-item-temp">${Math.round(city.temperature)}${unitSymbol}</div>
            <div class="weather-item-desc">${city.description || 'N/A'}</div>
        `;
        weatherItem.addEventListener('click', () => {
            cityInput.value = city.city;
            searchWeather();
        });
        weatherList.appendChild(weatherItem);
    });
}

// Switch Temperature Unit
function switchUnit(unit) {
    currentUnit = unit;
    if (unit === 'metric') {
        celsiusBtn.classList.add('active');
        fahrenheitBtn.classList.remove('active');
    } else {
        fahrenheitBtn.classList.add('active');
        celsiusBtn.classList.remove('active');
    }

    if (currentCity) {
        searchWeather();
    }
}

// Utility Functions
function formatTime(date) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function showLoading(show) {
    loadingSpinner.classList.toggle('hidden', !show);
}

function showError(message) {
    // You can enhance this with a dedicated error element
    if (message) {
        console.error(message);
        alert(message);
    }
}

function getWeatherIconCode(weatherMain) {
    const time = new Date().getHours() >= 6 && new Date().getHours() < 18 ? 'd' : 'n';
    const mainMap = {
        'Clear': '01',
        'Clouds': '02',
        'Rain': '10',
        'Drizzle': '09',
        'Thunderstorm': '11',
        'Snow': '13',
        'Mist': '50'
    };
    return (mainMap[weatherMain] || '04') + time;
}

// Initialize
loadAllWeather();
