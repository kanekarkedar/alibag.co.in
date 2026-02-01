const fs = require('fs');
const path = require('path');
// Usage: node import-csv.js hotels.csv

const csvFile = process.argv[2];
if (!csvFile) {
    console.log('Usage: node import-csv.js <path-to-csv>');
    process.exit(1);
}

const csvData = fs.readFileSync(csvFile, 'utf8');
const lines = csvData.split('\n');
const headers = lines[0].split(',').map(h => h.trim());

const hotels = [];

for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const line = lines[i].trim();

    // parseCSVLine handles quoted strings correctly
    const parseCSVLine = (str) => {
        const result = [];
        let current = '';
        let inQuote = false;
        for (let j = 0; j < str.length; j++) {
            const char = str[j];
            if (char === '"') { inQuote = !inQuote; continue; }
            if (char === ',' && !inQuote) {
                result.push(current.trim());
                current = '';
                continue;
            }
            current += char;
        }
        result.push(current.trim());
        return result;
    };

    const parsedValues = parseCSVLine(line);

    // CSV Columns: SKU Code,Resort Name,Location,Pincode,Swimming Pool,Nearness to Beach,Rates
    const sku = parsedValues[0];      // R001
    const name = parsedValues[1];     // The Blue Sky
    const location = parsedValues[2]; // Alibag
    const pincode = parsedValues[3];
    const swimming = parsedValues[4];
    const nearness = parsedValues[5];
    const rateStr = parsedValues[6];  // Rs. 5000/night
    // Minimal mapping: Adjust indices based on your Excel export
    // Parse Amenities
    const amenities = ['Wifi'];
    if (swimming && swimming.toLowerCase() === 'yes') amenities.push('Pool');

    // Parse Price
    let price = 5000;
    if (rateStr) {
        const numbers = rateStr.match(/\d+/);
        if (numbers) price = parseInt(numbers[0]);
    }

    const hotel = {
        id: Date.now() + i,
        owner_id: 'imported_' + sku,
        name: name || 'Unknown Hotel',
        location: location || 'Alibag',
        category: 'Villa',
        price: price,
        description: `Located ${nearness}. A wonderful stay.`,
        amenities: amenities,
        is_active: true,
        images: ['https://images.unsplash.com/photo-1540541338287-41700207dee6?w=600'],
        roomTypes: [{ name: "Standard Room", price: price, available: true, description: "Cozy room with basic amenities" }],
        reviews: [],
        rating: 4.5
    };
    hotels.push(hotel);
}

const outFile = path.join(__dirname, 'data/hotels.json');
fs.writeFileSync(outFile, JSON.stringify(hotels, null, 2));

console.log(`✅ Imported ${hotels.length} hotels to ${outFile}`);
