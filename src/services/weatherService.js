import axios from 'axios';
import Weather from '../models/Weather.js';
import logger from '../utils/logger.js';

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';

// Fetch weather by city name
export const fetchWeatherByCity = async (city, units = 'metric') => {
  try {
    const response = await axios.get(
      `${OPENWEATHER_BASE_URL}/weather`,
      {
        params: {
          q: city,
          appid: OPENWEATHER_API_KEY,
          units: units
        }
      }
    );

    return formatWeatherData(response.data);
  } catch (error) {
    logger.error(`Error fetching weather for ${city}: ${error.message}`);
    throw new Error(`Failed to fetch weather data for ${city}`);
  }
};

// Fetch weather by coordinates
export const fetchWeatherByCoordinates = async (lat, lon, units = 'metric') => {
  try {
    const response = await axios.get(
      `${OPENWEATHER_BASE_URL}/weather`,
      {
        params: {
          lat: lat,
          lon: lon,
          appid: OPENWEATHER_API_KEY,
          units: units
        }
      }
    );

    return formatWeatherData(response.data);
  } catch (error) {
    logger.error(`Error fetching weather for coordinates: ${error.message}`);
    throw new Error('Failed to fetch weather data');
  }
};

// Fetch extended forecast
export const fetchWeatherForecast = async (city, units = 'metric') => {
  try {
    const response = await axios.get(
      `${OPENWEATHER_BASE_URL}/forecast`,
      {
        params: {
          q: city,
          appid: OPENWEATHER_API_KEY,
          units: units
        }
      }
    );

    return response.data;
  } catch (error) {
    logger.error(`Error fetching forecast for ${city}: ${error.message}`);
    throw new Error(`Failed to fetch forecast data for ${city}`);
  }
};

// Format weather data for storage/response
const formatWeatherData = (rawData) => {
  return {
    city: rawData.name,
    country: rawData.sys?.country,
    latitude: rawData.coord?.lat,
    longitude: rawData.coord?.lon,
    temperature: rawData.main?.temp,
    feelsLike: rawData.main?.feels_like,
    tempMin: rawData.main?.temp_min,
    tempMax: rawData.main?.temp_max,
    humidity: rawData.main?.humidity,
    pressure: rawData.main?.pressure,
    description: rawData.weather?.[0]?.description,
    weatherMain: rawData.weather?.[0]?.main,
    windSpeed: rawData.wind?.speed,
    windDeg: rawData.wind?.deg,
    cloudiness: rawData.clouds?.all,
    visibility: rawData.visibility,
    rainfall: rawData.rain?.['1h'],
    snowfall: rawData.snow?.['1h'],
    sunrise: new Date(rawData.sys?.sunrise * 1000),
    sunset: new Date(rawData.sys?.sunset * 1000),
    timezone: rawData.timezone
  };
};

// Save weather data to database
export const saveWeatherData = async (weatherData) => {
  try {
    // Find and update or create
    const weather = await Weather.findOneAndUpdate(
      { city: weatherData.city },
      weatherData,
      { upsert: true, new: true }
    );

    logger.info(`Weather data saved for ${weatherData.city}`);
    return weather;
  } catch (error) {
    logger.error(`Error saving weather data: ${error.message}`);
    throw error;
  }
};

// Get cached weather from database
export const getCachedWeather = async (city) => {
  try {
    const weather = await Weather.findOne({ city: city });
    return weather;
  } catch (error) {
    logger.error(`Error retrieving cached weather: ${error.message}`);
    return null;
  }
};

// Get all cached cities
export const getAllCachedWeather = async () => {
  try {
    const weather = await Weather.find().sort({ lastUpdated: -1 });
    return weather;
  } catch (error) {
    logger.error(`Error retrieving all cached weather: ${error.message}`);
    return [];
  }
};
