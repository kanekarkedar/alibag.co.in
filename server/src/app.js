const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const morgan = require('morgan');
const helmet = require('helmet');

const rateLimit = require('express-rate-limit');
const xss = require('xss');

const app = express();

// Security Middleware
app.use(helmet());

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api/', limiter);

app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10kb' })); // Body limit to prevent DoS
app.use(morgan('dev'));
app.use('/uploads', express.static('uploads'));

// Multer Setup
const upload = multer({ dest: 'uploads/' });

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, '../data');

// Serve Static Files (Frontend)
app.use(express.static(path.join(__dirname, '../../')));

const { sequelize, Hotel, Room, Review, Booking, User, BlockedDate } = require('./models');

// Sequelize Connection and Sync
sequelize.authenticate()
    .then(() => {
        console.log('✅ PostgreSQL Connected');
        return sequelize.sync({ alter: true }); // Sync models to DB
    })
    .catch(err => console.error('❌ PostgreSQL Connection Error:', err));

// Seed Data Helper
async function seedData() {
    try {
        const count = await Hotel.count();
        if (count === 0) {
            console.log('Seeding initial hotels...');
            // Check if file exists before reading
            try {
                const seedHotels = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'hotels.json'), 'utf8'));

                for (const hData of seedHotels) {
                    const { roomTypes, reviews, ...hotelAttrs } = hData;
                    const hotel = await Hotel.create(hotelAttrs);

                    if (roomTypes && roomTypes.length > 0) {
                        const rooms = roomTypes.map(r => ({ ...r, hotelId: hotel.id }));
                        await Room.bulkCreate(rooms);
                    }

                    if (reviews && reviews.length > 0) {
                        const revs = reviews.map(r => ({
                            userName: r.user,
                            rating: r.rating,
                            text: r.text,
                            date: r.date,
                            hotelId: hotel.id
                        }));
                        await Review.bulkCreate(revs);
                    }
                }
                console.log('✅ Seeded Hotels, Rooms, and Reviews');
            } catch (err) {
                console.log('No seed file found or failed to parse, skipping seed.', err.message);
            }
        }

        // Seed Admin User if not exists
        const adminCount = await User.count({ where: { role: 'admin' } });
        if (adminCount === 0) {
            const adminUser = {
                id: 'admin_1',
                name: 'Admin User',
                email: process.env.ADMIN_EMAIL || 'admin@cutestay.com',
                password_hash: process.env.ADMIN_PASSWORD || 'change-me-immediately',
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

const admin = require('firebase-admin');

// Firebase Admin Setup
// You need to download your service account JSON from Firebase Console -> Project Settings -> Service Accounts
try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
        : require('../firebase-service-account.json');

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin Initialized');
} catch (e) {
    console.error('⚠️ Firebase Admin failed to initialize. Please check FIREBASE_SERVICE_ACCOUNT or firebase-service-account.json');
}

// Helper: Auth Middleware
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = {
            id: decodedToken.uid,
            email: decodedToken.email,
            name: decodedToken.name || decodedToken.email.split('@')[0],
            role: decodedToken.role || 'user' // You can set this via custom claims
        };
        next();
    } catch (err) {
        console.error('Auth Error:', err.message);
        res.sendStatus(403);
    }
};

const authorize = (roles = []) => {
    return (req, res, next) => {
        if (!req.user) return res.sendStatus(401);
        if (roles.length && !roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: 'Forbidden: Insufficient permissions' });
        }
        next();
    };
};

// --- Routes ---

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../../index.html')));

// Auth API removed - Handled by Firebase Client SDK

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

            const hotel = await Hotel.create({
                id: Date.now() + i,
                name: values[0] || 'Imported Hotel',
                location: values[1] || 'Alibag',
                category: values[2] || 'Villa',
                price: parseInt(values[3]) || 5000,
                description: values[4] || 'A lovely stay.',
                amenities: ['Wifi', 'Parking'], // Default
                is_active: true,
                images: ['https://images.unsplash.com/photo-1571896349842-6e5c48dc52e3?w=600'],
                rating: 4.5
            });

            // Create default room for imported hotel
            await Room.create({
                name: 'Standard Room',
                price: hotel.price,
                available: true,
                description: 'Default room for ' + hotel.name,
                hotelId: hotel.id
            });

            hotelsToInsert.push(hotel);
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
        const hotels = await Hotel.findAll({
            include: [
                {
                    model: Room,
                    include: [BlockedDate]
                },
                Review
            ]
        });
        res.json({ data: hotels });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/hotels/:id', async (req, res) => {
    try {
        const hotel = await Hotel.findOne({
            where: { id: req.params.id },
            include: [
                {
                    model: Room,
                    include: [BlockedDate]
                },
                Review
            ]
        });
        if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
        res.json({ data: hotel });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/hotels/:id/reviews', authenticateToken, async (req, res) => {
    const hotelId = parseInt(req.params.id);
    const { rating, text } = req.body;
    const user = req.user.name; // Get name from verified token

    // 1. Strict Profanity Filter
    const forbidden = [
        'fuck', 'shit', 'damn', 'stupid', 'awful', 'hate', 'badword', 'bloody',
        'idiot', 'crap', 'garbage', 'worst', 'pathetic', 'scam', 'fake'
    ];
    const regex = new RegExp(`\\b(${forbidden.join('|')})\\b`, 'i');
    if (regex.test(text)) {
        return res.status(400).json({ success: false, message: 'Review contains inappropriate language.' });
    }

    try {
        const hotel = await Hotel.findOne({ where: { id: hotelId } });
        if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });

        const newReview = await Review.create({
            userName: xss(user),
            rating: parseInt(rating),
            text: xss(text || ''),
            date: new Date().toISOString().split('T')[0],
            hotelId: hotel.id,
            userId: req.user.id
        });

        // Recalculate Rating from Review table
        const reviews = await Review.findAll({ where: { hotelId: hotel.id } });
        const total = reviews.reduce((sum, r) => sum + r.rating, 0);
        hotel.rating = parseFloat((total / reviews.length).toFixed(1));
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

    const hotelData = {
        id: Date.now(),
        owner_id: `admin_${req.user.id}`,
        name: xss(name),
        location: xss(location),
        category: xss(category || 'Villa'),
        price: parseInt(price),
        description: xss(description || 'New lovely stay.'),
        amenities: ['Wifi', 'Parking'],
        is_active: true,
        images: [image || 'https://images.unsplash.com/photo-1571896349842-6e5c48dc52e3?w=600'],
        rating: 5.0
    };

    const newHotel = await Hotel.create(hotelData);

    // Create a default room for the new hotel
    await Room.create({
        name: 'Standard Room',
        price: hotelData.price,
        available: true,
        description: 'Default room type for ' + hotelData.name,
        hotelId: newHotel.id
    });

    res.json({ success: true, data: newHotel });
});

// Availability Update (Owner)
app.post('/api/owner/update-availability', authenticateToken, authorize(['owner', 'admin']), async (req, res) => {
    const { hotelId, updates } = req.body;
    // In real app, check if hotelId belongs to req.user.id if role is 'owner'

    try {
        const hotel = await Hotel.findOne({ where: { id: hotelId }, include: [Room] });
        if (!hotel) return res.status(404).json({ error: 'Hotel not found' });

        for (const rtName of Object.keys(updates)) {
            await Room.update(
                { available: updates[rtName] },
                { where: { hotelId: hotel.id, name: rtName } }
            );
        }

        const updatedRooms = await Room.findAll({ where: { hotelId: hotel.id } });
        res.json({ success: true, data: updatedRooms });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Update Hotel Info (Owner)
app.put('/api/owner/hotels/:id', authenticateToken, authorize(['owner', 'admin']), async (req, res) => {
    try {
        const hotel = await Hotel.findOne({ id: req.params.id });
        if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });

        // Basic security check: owner must match or be admin
        if (req.user.role === 'owner' && hotel.owner_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Unauthorized: You do not own this hotel' });
        }

        const updates = req.body;
        Object.keys(updates).forEach(key => {
            if (['name', 'location', 'description', 'price', 'images', 'amenities'].includes(key)) {
                hotel[key] = (typeof updates[key] === 'string' && !['images', 'amenities'].includes(key))
                    ? xss(updates[key])
                    : updates[key];
            }
        });

        await hotel.save();
        res.json({ success: true, data: hotel });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// --- Owner Availability Toggle ---
app.post('/api/owner/rooms/:roomId/toggle-date', authenticateToken, authorize(['owner', 'admin']), async (req, res) => {
    const { date } = req.body; // YYYY-MM-DD
    if (!date) return res.status(400).json({ success: false, message: 'Date required' });

    try {
        const room = await Room.findByPk(req.params.roomId);
        if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

        // Basic security: Check if user owns the hotel this room belongs to
        const hotel = await Hotel.findByPk(room.hotelId);
        if (req.user.role === 'owner' && hotel.owner_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const existing = await BlockedDate.findOne({
            where: { roomId: room.id, date }
        });

        if (existing) {
            await existing.destroy();
            res.json({ success: true, action: 'REMOVED', date });
        } else {
            const blocked = await BlockedDate.create({
                roomId: room.id,
                date,
                reason: 'Occupied'
            });
            res.json({ success: true, action: 'ADDED', data: blocked });
        }
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// --- Bookings API ---

app.get('/api/bookings', authenticateToken, async (req, res) => {
    try {
        const bookings = await Booking.findAll({
            where: { userId: req.user.id },
            include: [
                {
                    model: Room,
                    include: [Hotel]
                }
            ],
            order: [['createdAt', 'DESC']]
        });
        res.json({ success: true, data: bookings });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.post('/api/bookings', authenticateToken, async (req, res) => {
    const { roomId, checkIn, checkOut, nights, totalPrice } = req.body;

    if (!roomId || !checkIn || !checkOut) {
        return res.status(400).json({ success: false, message: 'Missing booking details' });
    }

    try {
        const room = await Room.findByPk(roomId);
        if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

        const booking = await Booking.create({
            roomId,
            userId: req.user.id,
            checkIn,
            checkOut,
            nights,
            totalPrice,
            status: 'PENDING_CONFIRMATION'
        });

        res.json({ success: true, data: booking });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// Specials API
app.get('/api/specials', (req, res) => {
    const deals = [
        {
            title: 'Early Bird Beach Offer 🌴',
            description: 'Book 30 days in advance and get 15% off on all Beach Villas.',
            discount: '15% OFF',
            code: 'EARLYBEACH',
            image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=600',
            valid_until: 'Dec 2025',
            category_filter: 'Beach',
            text_color: '#FF6B81'
        },
        {
            title: 'Cozy Jungle Escape 🌿',
            description: 'Perfect for nature lovers. Flat ₹2000 off on weekend bookings.',
            discount: '₹2000 OFF',
            code: 'JUNGLEVIBE',
            image: 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=600',
            valid_until: 'Nov 2025',
            category_filter: 'Jungle',
            text_color: '#00B894'
        }
    ];
    res.json({ success: true, data: deals });
});

// Start Server
if (require.main === module) {
    // Listen on all interfaces (Required for Render)
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
}

module.exports = app;
