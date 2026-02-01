const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const morgan = require('morgan');
const helmet = require('helmet');

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
    origin: '*', // Allow all origins for this demo
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(morgan('dev'));
app.use('/uploads', express.static('uploads'));

// Multer Setup
const upload = multer({ dest: 'uploads/' });

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, '../data');

// Serve Static Files (Frontend)
app.use(express.static(path.join(__dirname, '../../')));

const mongoose = require('mongoose');
const { Hotel, Booking, User } = require('./models');

// Load env (for optional local .env)
require('dotenv').config();

// Mongoose Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cutestay';

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Seed Data Helper
async function seedData() {
    try {
        const count = await Hotel.countDocuments();
        if (count === 0) {
            console.log('Seeding initial hotels...');
            // Check if file exists before reading
            try {
                const seedHotels = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'hotels.json'), 'utf8'));
                await Hotel.insertMany(seedHotels);
                console.log('✅ Seeded Hotels');
            } catch (err) {
                console.log('No seed file found, skipping seed.');
            }
        }

        // Seed Admin User if not exists
        const adminCount = await User.countDocuments({ role: 'admin' });
        if (adminCount === 0) {
            const adminUser = {
                id: 'admin_1',
                name: 'Admin User',
                email: 'admin@cutestay.com',
                password_hash: 'admin123', // In real app, hash this!
                role: 'admin'
            };
            await User.create(adminUser);
            console.log('✅ Seeded Admin User');
        }

    } catch (e) {
        console.error('Seed Error:', e);
    }
}

// Initial Load
seedData();

const jwt = require('jsonwebtoken');
const JWT_SECRET = 'ALIBAG_SECRET_KEY_999'; // In prod, use .env

// Helper: Auth Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- Routes ---

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../../index.html')));

// Auth API
// Auth API
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });

        // Simple password check (In real app, use bcrypt)
        if (user && user.password_hash === password) {
            const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET);
            res.json({ success: true, token, user: { id: user.id, name: user.name, role: user.role } });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (e) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Admin Import API
app.post('/api/admin/import', authenticateToken, upload.single('file'), async (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        const csvData = await fs.readFile(req.file.path, 'utf8');
        const lines = csvData.split('\n');
        const hotelsToInsert = [];

        // Skip header, process lines
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const values = lines[i].split(',');

            const hotel = {
                id: Date.now() + i,
                name: values[0] || 'Imported Hotel',
                location: values[1] || 'Alibag',
                category: values[2] || 'Villa',
                price: parseInt(values[3]) || 5000,
                description: values[4] || 'A lovely stay.',
                amenities: ['Wifi', 'Parking'], // Default
                is_active: true,
                images: ['https://images.unsplash.com/photo-1571896349842-6e5c48dc52e3?w=600'],
                roomTypes: [],
                reviews: [],
                rating: 4.5
            };
            hotelsToInsert.push(hotel);
        }

        if (hotelsToInsert.length > 0) {
            await Hotel.insertMany(hotelsToInsert);
        }

        // Clean up temp file
        await fs.unlink(req.file.path);

        res.json({ success: true, count: hotelsToInsert.length, message: 'Import successful' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/hotels', async (req, res) => {
    try {
        const hotels = await Hotel.find({});
        res.json({ data: hotels });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/hotels/:id', async (req, res) => {
    try {
        const hotel = await Hotel.findOne({ id: req.params.id });
        if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
        res.json({ data: hotel });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/hotels/:id/reviews', async (req, res) => {
    const hotelId = parseInt(req.params.id);
    const { user, rating, text } = req.body;

    // 1. Strict Profanity Filter
    const forbidden = ['fuck', 'shit', 'damn', 'stupid', 'awful', 'hate', 'badword', 'bloody'];
    if (forbidden.some(w => text.toLowerCase().includes(w))) {
        return res.status(400).json({ success: false, message: 'Review contains inappropriate language.' });
    }

    try {
        const hotel = await Hotel.findOne({ id: hotelId });
        if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });

        const newReview = {
            id: Date.now(),
            user: user || 'Anonymous',
            rating: parseInt(rating),
            text: text || '',
            date: new Date().toISOString().split('T')[0]
        };

        if (!hotel.reviews) hotel.reviews = [];
        hotel.reviews.unshift(newReview);

        // Recalculate Rating
        const total = hotel.reviews.reduce((sum, r) => sum + r.rating, 0);
        hotel.rating = (total / hotel.reviews.length).toFixed(1);

        await hotel.save();

        res.json({ success: true, data: newReview, newRating: hotel.rating });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// Admin Add Hotel API
app.post('/api/hotels', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);

    const { name, location, price, category, description, image } = req.body;

    if (!name || !price || !location) {
        return res.status(400).json({ success: false, message: 'Missing required fields (name, price, location)' });
    }

    const newHotel = new Hotel({
        id: Date.now(), // Consider switching to _id if possible, but keeping id for frontend compat
        owner_id: `admin_${req.user.id}`,
        name,
        location,
        category: category || 'Villa',
        price: parseInt(price),
        description: description || 'New lovely stay.',
        amenities: ['Wifi', 'Parking'],
        is_active: true,
        images: [image || 'https://images.unsplash.com/photo-1571896349842-6e5c48dc52e3?w=600'],
        roomTypes: [],
        reviews: [],
        rating: 5.0
    });

    await newHotel.save();

    res.json({ success: true, data: newHotel });
});

// Availability Update (Owner)
app.post('/api/owner/update-availability', async (req, res) => {
    const { key, hotelId, updates } = req.body;
    if (key !== 'MASTER_KEY_123') return res.status(403).json({ error: 'Unauthorized' });

    try {
        const hotel = await Hotel.findOne({ id: hotelId });
        if (!hotel) return res.status(404).json({ error: 'Hotel not found' });

        if (hotel.roomTypes) {
            hotel.roomTypes.forEach(rt => {
                if (updates[rt.name] !== undefined) rt.available = updates[rt.name];
            });
            await hotel.save();
        }
        res.json({ success: true, data: hotel.roomTypes });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Specials API
app.get('/api/specials', (req, res) => {
    // res.json({ data: DB.specials || [] }); // DB is gone
    res.json({ data: [] }); // Empty for now to valid crashes
});

// Start Server
if (require.main === module) {
    // Listen on all interfaces (Required for Render)
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
}

module.exports = app;
