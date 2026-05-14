import mongoose from 'mongoose';

const weatherSchema = new mongoose.Schema(
  {
    city: {
      type: String,
      required: true
    },
    country: String,
    latitude: Number,
    longitude: Number,
    temperature: {
      type: Number,
      required: true
    },
    feelsLike: Number,
    tempMin: Number,
    tempMax: Number,
    humidity: Number,
    pressure: Number,
    description: String,
    weatherMain: String,
    windSpeed: Number,
    windDeg: Number,
    cloudiness: Number,
    visibility: Number,
    rainfall: Number,
    snowfall: Number,
    uvIndex: Number,
    sunrise: Date,
    sunset: Date,
    timezone: String,
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model('Weather', weatherSchema);
