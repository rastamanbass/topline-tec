const fs = require('fs');
const path = require('path');

// Patterns
const SUPPLIERS = ['HEC', 'ZK', 'WNY', 'REC', 'TRAD', 'RUB', 'LZ', 'OH', 'ANG', 'RB', 'HE', 'Apple', 'samsung', 'iphone', 'xtra'];
const REPLACEMENTS = {
    '11': 'iPhone 11', '12': 'iPhone 12', '13': 'iPhone 13', '14': 'iPhone 14',
    '15': 'iPhone 15', '16': 'iPhone 16', '17': 'iPhone 17',
    'NOTE': 'Galaxy Note', 'S21': 'Galaxy S21', 'S22': 'Galaxy S22',
    'S23': 'Galaxy S23', 'S24': 'Galaxy S24', 'S25': 'Galaxy S25'
};

function parseDamage(raw) {
    const DAMAGES = ['RAJADO', 'BROKEN', 'RAYADO', 'TAPADERA', 'PANTALLA', 'LOCKED', 'MENSAJE', 'FACE ID'];
    const found = [];
    const upper = raw.toUpperCase();
    DAMAGES.forEach(d => {
        if (upper.includes(d)) found.push(d);
    });
    return found.length > 0 ? found.join(', ') : 'Good'; // Default to Good/Used
}

function parseStorage(raw) {
    const match = raw.match(/(\d+)(GB|TB)/i);
    return match ? match[0].toUpperCase() : 'Unknown';
}

function cleanModelName(raw) {
    let clean = raw.trim();
    for (const sup of SUPPLIERS) {
        clean = clean.replace(new RegExp(`^${sup}\\s+`, 'i'), '');
    }
    const firstWord = clean.split(' ')[0];
    if (REPLACEMENTS[firstWord.toUpperCase()]) {
        clean = clean.replace(new RegExp(`^${firstWord}`, 'i'), REPLACEMENTS[firstWord.toUpperCase()]);
    } else {
        const upper = clean.toUpperCase();
        if (upper.startsWith('S2')) clean = 'Samsung Galaxy ' + clean;
        else if (upper.startsWith('A') && !upper.startsWith('APPLE') && /^A\d\d/.test(upper)) clean = 'Samsung ' + clean;
    }

    // Remove attributes strictly for the "Model Name" field, but keep relevant ones
    clean = clean.replace(/RAJADO.*/i, '').replace(/BACK GLASS.*/i, '').replace(/OPEN BOX.*/i, '')
        .replace(/CAJA.*/i, '').replace(/NEW.*/i, '').replace(/DUOS.*/i, '')
        .replace(/MENSAJE.*/i, '').replace(/NO FACE ID.*/i, '').trim();

    return clean.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())
        .replace(/Iphone/g, 'iPhone').replace(/Samsung/g, 'Samsung').replace(/Pro/g, 'Pro').replace(/Max/g, 'Max').replace(/Gb/g, 'GB');
}

function processFile(filePath) {
    console.log(`Processing ${filePath} for Enrichment...`);
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const lines = rawData.split('\n');
    const inventory = [];
    let count = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const imeiMatch = line.match(/(\d{15})/);

        if (imeiMatch) {
            const imei = imeiMatch[1];

            // 1. Description Analysis
            let desc = '';
            let fullDescRaw = '';

            if (i > 0) {
                let rawDesc = lines[i - 1].trim();
                rawDesc = rawDesc.replace(/^\d+\s+/, '').replace(/^"/, '').replace(/"$/, '').trim();
                fullDescRaw = rawDesc;
                if (rawDesc.length > 3 && /[a-zA-Z]/.test(rawDesc)) {
                    desc = cleanModelName(rawDesc);
                }
            }

            // 2. Attributes
            // Storage
            const storage = parseStorage(fullDescRaw);
            // Condition/Damage
            const damage = parseDamage(fullDescRaw);
            let condition = 'Used';
            if (fullDescRaw.toUpperCase().includes('NEW')) condition = 'New';
            else if (fullDescRaw.toUpperCase().includes('OPEN BOX')) condition = 'Open Box';
            else if (damage !== 'Good') condition = 'Damaged (' + damage + ')';

            // 3. Price, Status, Buyer
            const afterImei = line.substring(line.indexOf(imei) + 15).replace(/^"/, '').trim();
            const parts = afterImei.split(/\t+/);

            let status = 'En Stock (Disponible para Venta)';
            let buyer = null;
            let price = 0;
            let cost = 0;

            if (parts.length >= 4) {
                status = parts[0].trim();

                // Buyer Check (Column 1: Client)
                const clientCol = parts[1].trim();
                if (clientCol !== 'N/A' && clientCol.length > 2) {
                    buyer = clientCol;
                }

                // Cost & Price
                cost = parseFloat(parts[2].replace(/[$,]/g, '')) || 0;
                price = parseFloat(parts[3].replace(/[$,]/g, '')) || 0;
            }

            if (desc && desc.length > 3) {
                const item = {
                    imei: imei,
                    marca: desc.includes('iPhone') || desc.includes('Apple') ? 'Apple' :
                        desc.includes('Samsung') ? 'Samsung' : 'Unknown',
                    modelo: desc,
                    storage: storage,
                    condition: condition,
                    precioVenta: price,
                    costo: cost,
                    estado: status,
                    comprador: buyer, // New Field
                    fechaIngreso: new Date().toISOString(),
                    id: Math.random().toString(36).substr(2, 9)
                };

                inventory.push(item);
                count++;
            }
        }
    }

    console.log(`Extracted ${count} enriched items.`);
    // Console log one with a buyer if possible
    const soldParams = inventory.find(i => i.comprador);
    if (soldParams) console.log('Sample Sold Item:', soldParams);

    fs.writeFileSync('inventory_seed_enriched.json', JSON.stringify(inventory, null, 2));
}

processFile(path.join(__dirname, '../legacy_dump_full.txt'));
