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
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use('/uploads', express.static('uploads'));

// Multer Setup
const upload = multer({ dest: 'uploads/' });

const PORT = 3000;
const DATA_DIR = path.join(__dirname, '../data');

// DB Wrapper
const DB = {
    hotels: [],
    users: [],
    bookings: []
};

// Data Persistence Helpers
async function loadData() {
    try {
        const hotelsData = await fs.readFile(path.join(DATA_DIR, 'hotels.json'), 'utf8');
        DB.hotels = JSON.parse(hotelsData);

        // Ensure users.json exists or handle error
        try {
            const usersData = await fs.readFile(path.join(DATA_DIR, 'users.json'), 'utf8');
            DB.users = JSON.parse(usersData);
        } catch (e) { DB.users = []; }

        // Load Specials
        try {
            const specialsData = await fs.readFile(path.join(DATA_DIR, 'specials.json'), 'utf8');
            DB.specials = JSON.parse(specialsData);
        } catch (e) { DB.specials = []; }

        console.log('✅ persist: Data loaded.');
    } catch (e) {
        console.error('⚠️ persist: Failed to load data:', e.message);
    }
}

async function saveData(file, data) {
    try {
        await fs.writeFile(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
    } catch (e) { console.error('❌ persist: Save failed:', e.message); }
}

// Initial Load
loadData();

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

app.get('/', (req, res) => res.json({ status: 'ok', msg: 'CuteStay API Persistent v2' }));

// Auth API
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = DB.users.find(u => u.email === email);

    // Simple password check (In real app, use bcrypt)
    if (user && user.password_hash === password) {
        const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET);
        res.json({ success: true, token, user: { id: user.id, name: user.name, role: user.role } });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// Admin Import API
app.post('/api/admin/import', authenticateToken, upload.single('file'), async (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        const csvData = await fs.readFile(req.file.path, 'utf8');
        const lines = csvData.split('\n');

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
                reviews: []
            };
            DB.hotels.push(hotel);
        }

        await saveData('hotels.json', DB.hotels);
        // Clean up temp file
        await fs.unlink(req.file.path);

        res.json({ success: true, count: DB.hotels.length, message: 'Import successful' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/hotels', (req, res) => res.json({ data: DB.hotels }));

app.get('/api/hotels/:id', (req, res) => {
    const hotel = DB.hotels.find(h => h.id == req.params.id);
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
    res.json({ data: hotel });
});

app.post('/api/hotels/:id/reviews', async (req, res) => {
    const hotelId = parseInt(req.params.id);
    const { user, rating, text } = req.body;

    // 1. Strict Profanity Filter
    const forbidden = ['fuck', 'shit', 'damn', 'stupid', 'awful', 'hate', 'badword', 'bloody'];
    if (forbidden.some(w => text.toLowerCase().includes(w))) {
        return res.status(400).json({ success: false, message: 'Review contains inappropriate language.' });
    }

    const hotel = DB.hotels.find(h => h.id === hotelId);
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

    // PERSIST CHANGE
    await saveData('hotels.json', DB.hotels);

    res.json({ success: true, data: newReview, newRating: hotel.rating });
});

// Availability Update (Owner)
app.post('/api/owner/update-availability', async (req, res) => {
    const { key, hotelId, updates } = req.body;
    if (key !== 'MASTER_KEY_123') return res.status(403).json({ error: 'Unauthorized' });

    const hotel = DB.hotels.find(h => h.id == hotelId);
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });

    if (hotel.roomTypes) {
        hotel.roomTypes.forEach(rt => {
            if (updates[rt.name] !== undefined) rt.available = updates[rt.name];
        });
        // PERSIST
        await saveData('hotels.json', DB.hotels);
    }
    res.json({ success: true, data: hotel.roomTypes });
});

// Specials API
app.get('/api/specials', (req, res) => {
    res.json({ data: DB.specials || [] });
});

// Start Server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
