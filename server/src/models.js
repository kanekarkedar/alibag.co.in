const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL || 'postgres://localhost:5432/cutestay', {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
        ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com') ? {
            require: true,
            rejectUnauthorized: false
        } : false
    }
});

const User = sequelize.define('User', {
    id: { type: DataTypes.STRING, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password_hash: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.STRING, defaultValue: 'user' }
});

const Hotel = sequelize.define('Hotel', {
    id: { type: DataTypes.BIGINT, primaryKey: true },
    owner_id: { type: DataTypes.STRING },
    name: { type: DataTypes.STRING, allowNull: false },
    location: { type: DataTypes.STRING, allowNull: false },
    category: { type: DataTypes.STRING, defaultValue: 'Villa' },
    price: { type: DataTypes.INTEGER, allowNull: false }, // Base price
    description: { type: DataTypes.TEXT },
    amenities: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    images: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
    rating: { type: DataTypes.FLOAT, defaultValue: 4.5 }
});

const Room = sequelize.define('Room', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    price: { type: DataTypes.INTEGER, allowNull: false },
    available: { type: DataTypes.BOOLEAN, defaultValue: true },
    description: { type: DataTypes.TEXT }
});

const Review = sequelize.define('Review', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    userName: { type: DataTypes.STRING },
    rating: { type: DataTypes.INTEGER, allowNull: false },
    text: { type: DataTypes.TEXT, allowNull: false },
    date: { type: DataTypes.STRING }
});

const Booking = sequelize.define('Booking', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    checkIn: { type: DataTypes.STRING, allowNull: false },
    checkOut: { type: DataTypes.STRING, allowNull: false },
    nights: { type: DataTypes.INTEGER },
    totalPrice: { type: DataTypes.INTEGER },
    status: { type: DataTypes.STRING, defaultValue: 'PENDING_CONFIRMATION' }
});

const BlockedDate = sequelize.define('BlockedDate', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    date: { type: DataTypes.STRING, allowNull: false }, // YYYY-MM-DD
    reason: { type: DataTypes.STRING, defaultValue: 'Occupied' }
});

// Relationships
Hotel.hasMany(Room, { foreignKey: 'hotelId', onDelete: 'CASCADE' });
Room.belongsTo(Hotel, { foreignKey: 'hotelId' });

Hotel.hasMany(Review, { foreignKey: 'hotelId', onDelete: 'CASCADE' });
Review.belongsTo(Hotel, { foreignKey: 'hotelId' });

User.hasMany(Review, { foreignKey: 'userId' });
Review.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Booking, { foreignKey: 'userId' });
Booking.belongsTo(User, { foreignKey: 'userId' });

Room.hasMany(Booking, { foreignKey: 'roomId' });
Booking.belongsTo(Room, { foreignKey: 'roomId' });

Room.hasMany(BlockedDate, { foreignKey: 'roomId', onDelete: 'CASCADE' });
BlockedDate.belongsTo(Room, { foreignKey: 'roomId' });

module.exports = {
    sequelize,
    User,
    Hotel,
    Room,
    Review,
    Booking,
    BlockedDate
};
