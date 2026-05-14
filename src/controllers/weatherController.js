import {
  fetchWeatherByCity,
  fetchWeatherByCoordinates,
  fetchWeatherForecast,
  saveWeatherData,
  getCachedWeather,
  getAllCachedWeather
} from '../services/weatherService.js';
import FavoriteLocation from '../models/FavoriteLocation.js';
import logger from '../utils/logger.js';

// Get weather by city
export const getWeatherByCity = async (req, res, next) => {
  try {
    const { city, units = 'metric' } = req.query;

    if (!city) {
      return res.status(400).json({
        success: false,
        message: 'City name is required'
      });
    }

    const weatherData = await fetchWeatherByCity(city, units);
    await saveWeatherData(weatherData);

    res.json({
      success: true,
      data: weatherData,
      cached: false
    });
  } catch (error) {
    logger.error(`Weather fetch error: ${error.message}`);
    next(error);
  }
};

// Get weather by coordinates
export const getWeatherByCoordinates = async (req, res, next) => {
  try {
    const { lat, lon, units = 'metric' } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const weatherData = await fetchWeatherByCoordinates(lat, lon, units);
    await saveWeatherData(weatherData);

    res.json({
      success: true,
      data: weatherData,
      cached: false
    });
  } catch (error) {
    logger.error(`Weather fetch error: ${error.message}`);
    next(error);
  }
};

// Get weather forecast
export const getWeatherForecast = async (req, res, next) => {
  try {
    const { city, units = 'metric' } = req.query;

    if (!city) {
      return res.status(400).json({
        success: false,
        message: 'City name is required'
      });
    }

    const forecastData = await fetchWeatherForecast(city, units);

    res.json({
      success: true,
      data: forecastData
    });
  } catch (error) {
    logger.error(`Forecast fetch error: ${error.message}`);
    next(error);
  }
};

// Get cached weather
export const getCachedWeatherData = async (req, res, next) => {
  try {
    const { city } = req.query;

    if (!city) {
      return res.status(400).json({
        success: false,
        message: 'City name is required'
      });
    }

    const cachedWeather = await getCachedWeather(city);

    if (!cachedWeather) {
      return res.status(404).json({
        success: false,
        message: `No cached weather data for ${city}`
      });
    }

    res.json({
      success: true,
      data: cachedWeather,
      cached: true
    });
  } catch (error) {
    logger.error(`Cached weather fetch error: ${error.message}`);
    next(error);
  }
};

// Get all cached weather data
export const getAllWeatherData = async (req, res, next) => {
  try {
    const allWeather = await getAllCachedWeather();

    res.json({
      success: true,
      data: allWeather,
      count: allWeather.length
    });
  } catch (error) {
    logger.error(`All weather fetch error: ${error.message}`);
    next(error);
  }
};

// Add favorite location
export const addFavoriteLocation = async (req, res, next) => {
  try {
    const { city, country, latitude, longitude } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    if (!city) {
      return res.status(400).json({
        success: false,
        message: 'City name is required'
      });
    }

    const favorite = await FavoriteLocation.create({
      userId,
      city,
      country,
      latitude,
      longitude
    });

    logger.info(`Favorite location added for user ${userId}: ${city}`);

    res.status(201).json({
      success: true,
      data: favorite
    });
  } catch (error) {
    logger.error(`Add favorite error: ${error.message}`);
    next(error);
  }
};

// Get user favorite locations
export const getUserFavorites = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const favorites = await FavoriteLocation.find({ userId });

    res.json({
      success: true,
      data: favorites,
      count: favorites.length
    });
  } catch (error) {
    logger.error(`Get favorites error: ${error.message}`);
    next(error);
  }
};

// Remove favorite location
export const removeFavoriteLocation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const favorite = await FavoriteLocation.findByIdAndDelete(id);

    if (!favorite) {
      return res.status(404).json({
        success: false,
        message: 'Favorite location not found'
      });
    }

    logger.info(`Favorite location removed for user ${userId}`);

    res.json({
      success: true,
      message: 'Favorite location removed'
    });
  } catch (error) {
    logger.error(`Remove favorite error: ${error.message}`);
    next(error);
  }
};
