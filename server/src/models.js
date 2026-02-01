const mongoose = require('mongoose');

const hotelSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true }, // Keeping existing ID logic for now
    owner_id: String,
    name: { type: String, required: true },
    location: { type: String, required: true },
    category: { type: String, default: 'Villa' },
    price: { type: Number, required: true },
    description: String,
    amenities: [String],
    is_active: { type: Boolean, default: true },
    images: [String],
    roomTypes: [{
        name: String,
        price: Number,
        available: Boolean,
        description: String
    }],
    reviews: [{
        id: Number,
        user: String,
        rating: Number,
        comment: String,
        date: String
    }],
    rating: { type: Number, default: 4.5 }
});

const bookingSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    hotelId: Number,
    hotelName: String,
    roomType: String,
    checkIn: String,
    checkOut: String,
    nights: Number,
    totalPrice: Number,
    status: { type: String, default: 'PENDING_CONFIRMATION' },
    user: { type: Object } // Store minimal user data
});

const userSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password_hash: { type: String, required: true },
    role: { type: String, default: 'user' }
});

module.exports = {
    Hotel: mongoose.model('Hotel', hotelSchema),
    Booking: mongoose.model('Booking', bookingSchema),
    User: mongoose.model('User', userSchema)
};
