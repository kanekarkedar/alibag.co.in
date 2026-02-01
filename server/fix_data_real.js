const fs = require('fs');
const path = require('path');

const hotelsPath = path.join(__dirname, 'data/hotels.json');
const hotels = JSON.parse(fs.readFileSync(hotelsPath, 'utf8'));

// 1. The Blue Sky
const blueSky = hotels.find(h => h.owner_id === 'imported_R001' || h.name === 'The Blue Sky');
if (blueSky) {
    blueSky.name = "The Blue Sky"; // Ensure name is correct
    blueSky.images = ["https://theblueskyresortalibag.com/assets/tenant/img/gallery-image/fd217b987660d18a9e1dedd9de2f05a655d6da40.jpg"];
    console.log("Updated The Blue Sky");
}

fs.writeFileSync(hotelsPath, JSON.stringify(hotels, null, 2));
