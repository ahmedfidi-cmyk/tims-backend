import express from 'express';
import {
  getWeatherByCity,
  getWeatherByCoordinates,
  getWeatherForecast,
  getCachedWeatherData,
  getAllWeatherData,
  addFavoriteLocation,
  getUserFavorites,
  removeFavoriteLocation
} from '../controllers/weatherController.js';
import protect from '../middleware/authMiddleware.js';

const router = express.Router();

// Public weather routes
router.get('/current/city', getWeatherByCity);
router.get('/current/coordinates', getWeatherByCoordinates);
router.get('/forecast', getWeatherForecast);
router.get('/cached/city', getCachedWeatherData);
router.get('/cached/all', getAllWeatherData);

// Protected favorite locations routes
router.post('/favorites', protect, addFavoriteLocation);
router.get('/favorites', protect, getUserFavorites);
router.delete('/favorites/:id', protect, removeFavoriteLocation);

export default router;
