
import fs from 'fs';
import path from 'path';

const rawFile = path.join(process.cwd(), 'legacy_dump_full.txt');
const outFile = path.join(process.cwd(), 'src/data/inventory_seed_v2.json');

const rawContent = fs.readFileSync(rawFile, 'utf-8');

// Regex to handle the multiline "csv" format
// Entry format examples:
// 1\t"HEC 13 PRO MAX 1TB\n352114959064679"\tEn Tránsito... \t$0.00\t$540.00...
// 25\t"HEC 17 AIR 256GB\n7317"\t...
// Sometimes the description wraps.

const entries = [];
// Split by line, but we need to reconstruct the blocks.
// Valid blocks start with a Number + Tab.
const lines = rawContent.split('\n');
let currentBlock = '';

for (const line of lines) {
    if (/^\d+\t/.test(line)) {
        // New block starts
        if (currentBlock) processBlock(currentBlock);
        currentBlock = line;
    } else {
        // Continuation
        currentBlock += '\n' + line;
    }
}
if (currentBlock) processBlock(currentBlock);

function processBlock(block) {
    // 1\t"HEC...\nIMEI"\tStatus\tN/A\Cost\tPrice...
    // 1. Extract ID
    const idMatch = block.match(/^(\d+)\t/);
    if (!idMatch) return;

    // 2. Extract Quoted Content (Description + IMEI)
    // It's usually inside double quotes: "DESC\nIMEI"
    const quoteMatch = block.match(/"([^"]+)"/);
    let rawDesc = '';
    let imei = '';

    if (quoteMatch) {
        const parts = quoteMatch[1].split('\n');
        rawDesc = parts[0].trim(); // "HEC 13 PRO MAX 1TB"
        imei = parts[1]?.trim() || ''; // "3521..."
    }

    // 3. Extract Price (Look for $ amounts)
    const prices = block.match(/\$[\d,]+\.\d{2}/g);
    let sellPrice = 0;
    // Usually Cost is first ($0.00), Sell is second ($540.00)
    if (prices && prices.length >= 2) {
        sellPrice = parseFloat(prices[1].replace(/[$,]/g, ''));
    }

    // 4. Parse Description for Model, Storage, Condition
    // "HEC 16 256GB BACK RAJADO FRONT RAJADO ARO RAYADO"
    let brand = 'Unknown';
    let model = 'Unknown';
    let storage = 'Unknown';
    let condition = 'Used';
    let details = '';

    const cleanDesc = rawDesc.toUpperCase();

    // Brand Detection
    if (cleanDesc.includes('S23') || cleanDesc.includes('S24') || cleanDesc.includes('S22') || cleanDesc.includes('GALAXY')) {
        brand = 'Samsung';
    } else if (cleanDesc.includes('HEC') || cleanDesc.includes('IPHONE') || cleanDesc.includes('11') || cleanDesc.includes('12') || cleanDesc.includes('13') || cleanDesc.includes('14') || cleanDesc.includes('15') || cleanDesc.includes('16') || cleanDesc.includes('17')) {
        brand = 'Apple';
    }

    // Storage Detection
    const storageMatch = cleanDesc.match(/(\d+)(GB|TB)/);
    if (storageMatch) {
        storage = storageMatch[0];
    }

    // Model Extraction (Naive but effective)
    // Remove 'HEC', remove Storage, rest is Model + Condition
    let tempModel = cleanDesc.replace('HEC', '').replace(storage, '').trim();

    // Condition extraction
    if (tempModel.includes('RAJADO') || tempModel.includes('BROKEN') || tempModel.includes('RAYADO') || tempModel.includes('FRACTURA')) {
        condition = 'Grade C'; // Damaged
        details = tempModel; // Keep the full text as details
        // Try to shorten model name
        // "16 BACK RAJADO..." -> "iPhone 16"
        // We need a known models list or regex
    }

    // Normalize iPhone Names
    if (brand === 'Apple') {
        const numMatch = tempModel.match(/(\d+)(\s+(PRO|MAX|PLUS|MINI|AIR))*/);
        if (numMatch) {
            model = 'iPhone ' + numMatch[0];
            // If it had extra junk, put it in details
            if (tempModel.length > model.length + 8) { // heuristics
                details = tempModel;
            }
        }
    } else if (brand === 'Samsung') {
        if (tempModel.includes('S22')) model = 'Galaxy S22';
        if (tempModel.includes('S23')) model = 'Galaxy S23';
        if (tempModel.includes('S24')) model = 'Galaxy S24';
        if (tempModel.includes('ULTRA')) model += ' Ultra';
        else if (tempModel.includes('PLUS')) model += ' Plus';
    }

    // Fallback if model logic failed
    if (model === 'Unknown') model = cleanDesc;

    entries.push({
        id: idMatch[1], // Original Row ID
        imei: imei || `LEGACY-${idMatch[1]}`, // Fallback ID if no IMEI
        brand,
        model,
        storage,
        precioVenta: sellPrice,
        condition,
        details,
        estado: 'En Tránsito (a El Salvador)' // Default status from file
    });
}

console.log(`Parsed ${entries.length} items.`);
fs.writeFileSync(outFile, JSON.stringify(entries, null, 2));
