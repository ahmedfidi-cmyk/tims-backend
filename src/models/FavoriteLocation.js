import mongoose from 'mongoose';

const favoriteLocationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    city: {
      type: String,
      required: true
    },
    country: String,
    latitude: Number,
    longitude: Number,
    isFavorite: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model('FavoriteLocation', favoriteLocationSchema);
