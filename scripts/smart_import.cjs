const fs = require('fs');
const path = require('path');

// Suppliers/Prefixes to strip
const SUPPLIERS = [
    'HEC', 'ZK', 'WNY', 'REC', 'TRAD', 'RUB', 'LZ', 'OH', 'ANG', 'RB', 'HE', 'Apple', 'samsung', 'iphone', 'xtra'
];

// Heuristic replacements
const REPLACEMENTS = {
    '11': 'iPhone 11',
    '12': 'iPhone 12',
    '13': 'iPhone 13',
    '14': 'iPhone 14',
    '15': 'iPhone 15',
    '16': 'iPhone 16', // Future proof?
    '17': 'iPhone 17', // Future proof?
    'NOTE': 'Galaxy Note',
    'S21': 'Galaxy S21',
    'S22': 'Galaxy S22',
    'S23': 'Galaxy S23',
    'S24': 'Galaxy S24',
    'S25': 'Galaxy S25', // Future proof?
};

function cleanModelName(raw) {
    let clean = raw.trim();

    // 1. Remove Supplier Prefixes (Case Insensitive)
    for (const sup of SUPPLIERS) {
        const regex = new RegExp(`^${sup}\\s+`, 'i');
        clean = clean.replace(regex, '');
    }

    // 2. Detect "Just Numbers" (e.g. "12 PRO") -> "iPhone 12 PRO"
    const firstWord = clean.split(' ')[0];
    if (REPLACEMENTS[firstWord.toUpperCase()]) {
        clean = clean.replace(new RegExp(`^${firstWord}`, 'i'), REPLACEMENTS[firstWord.toUpperCase()]);
    } else {
        const upper = clean.toUpperCase();
        if (upper.startsWith('S2')) {
            clean = 'Samsung Galaxy ' + clean;
        }
        else if (upper.startsWith('A') && !upper.startsWith('APPLE')) {
            if (/^A\d\d/.test(upper)) {
                clean = 'Samsung ' + clean;
            }
        }
    }

    // 3. Cleanup Artifacts
    clean = clean.replace(/RAJADO.*/i, '').trim();
    clean = clean.replace(/BACK GLASS.*/i, '').trim();
    clean = clean.replace(/OPEN BOX.*/i, '').trim();
    clean = clean.replace(/CAJA.*/i, '').trim();
    clean = clean.replace(/NEW.*/i, '').trim();
    clean = clean.replace(/DUOS.*/i, '').trim();
    clean = clean.replace(/MENSAJE.*/i, '').trim();
    clean = clean.replace(/NO FACE ID.*/i, '').trim();

    // 4. Title Case Formatting
    return clean.replace(/\w\S*/g, (txt) => {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    }).replace(/Iphone/g, 'iPhone').replace(/Samsung/g, 'Samsung').replace(/Pro/g, 'Pro').replace(/Max/g, 'Max').replace(/Gb/g, 'GB');
}

function processFile(filePath) {
    console.log(`Processing ${filePath}...`);
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const lines = rawData.split('\n');
    const tacMap = {};
    let count = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Robust IMEI detection (15 digits usually at start of line or alone)
        // In the dump: "352114959064679" or 352114959064679
        const imeiMatch = line.match(/(\d{15})/);

        if (imeiMatch) {
            const imei = imeiMatch[1];
            const tac = imei.substring(0, 8);

            // Look backward for description (i-1)
            // Expect segment: 1 "HEC 13 PRO MAX 1TB
            // Or sometimes on the same line if format shifted, but usually i-1.

            if (i > 0) {
                let descLine = lines[i - 1].trim();

                // Cleanup the description line (Row Number, Tabs, Quotes)
                // Remove leading digits/tabs: 1	"
                descLine = descLine.replace(/^\d+\s+/, '').replace(/^"/, '').replace(/"$/, '').trim();

                // If description is too short, maybe try line i-2? (Rare)

                if (descLine.length > 3 && /[a-zA-Z]/.test(descLine)) {
                    const cleanModel = cleanModelName(descLine);

                    // Avoid Bad Parses
                    if (!cleanModel.toLowerCase().includes('transito') && !cleanModel.toLowerCase().includes('vendido')) {

                        if (cleanModel.length > 5) {
                            if (!tacMap[tac]) {
                                tacMap[tac] = { brand: 'Unknown', model: cleanModel };

                                // Infer Brand
                                if (cleanModel.toLowerCase().includes('iphone') || cleanModel.toLowerCase().includes('apple')) tacMap[tac].brand = 'Apple';
                                else if (cleanModel.toLowerCase().includes('samsung') || cleanModel.toLowerCase().includes('galaxy')) tacMap[tac].brand = 'Samsung';
                                else if (cleanModel.toLowerCase().includes('xiaomi')) tacMap[tac].brand = 'Xiaomi';

                                count++;
                            }
                        }
                    }
                }
            }
        }
    }

    console.log(`Extracted ${count} unique TAC definitions.`);
    fs.writeFileSync('legacy_tac_map_full.json', JSON.stringify(tacMap, null, 2));
}

processFile(path.join(__dirname, '../legacy_dump_full.txt'));
