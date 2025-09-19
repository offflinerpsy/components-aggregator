// Нормализация данных в канон Product
export function normalizeProduct(rawProduct) {
    return {
        mpn: normalizeMPN(rawProduct.mpn || rawProduct.code || rawProduct.partNumber || ''),
        description: normalizeDescription(rawProduct.description || rawProduct.name || ''),
        images: normalizeImages(rawProduct.images || []),
        datasheets: normalizeDatasheets(rawProduct.datasheets || []),
        availability: normalizeAvailability(rawProduct.availability || rawProduct.stock),
        pricing: normalizePricing(rawProduct.pricing || rawProduct.price),
        package: normalizePackage(rawProduct.package || rawProduct.case),
        packaging: normalizePackaging(rawProduct.packaging),
        url: normalizeUrl(rawProduct.url),
        suppliers: normalizeSuppliers(rawProduct.suppliers || []),
        technical_specs: normalizeTechnicalSpecs(rawProduct.technical_specs || rawProduct.specs || {})
    };
}

function normalizeMPN(mpn) {
    if (!mpn) return '';
    return mpn.toString().trim().toUpperCase();
}

function normalizeDescription(description) {
    if (!description) return '';
    return description.toString().trim();
}

function normalizeImages(images) {
    if (!Array.isArray(images)) return [];
    return images
        .filter(img => img && typeof img === 'string')
        .map(img => img.trim())
        .filter(img => img.length > 0);
}

function normalizeDatasheets(datasheets) {
    if (!Array.isArray(datasheets)) return [];
    return datasheets
        .filter(ds => ds && typeof ds === 'string')
        .map(ds => ds.trim())
        .filter(ds => ds.length > 0);
}

function normalizeAvailability(availability) {
    if (!availability) return { inStock: 0, lead: null };
    
    if (typeof availability === 'object') {
        return {
            inStock: Number(availability.inStock) || 0,
            lead: availability.lead || null
        };
    }
    
    const stockStr = availability.toString().toLowerCase();
    if (stockStr.includes('нет') || stockStr.includes('no') || stockStr.includes('out')) {
        return { inStock: 0, lead: null };
    }
    
    const match = stockStr.match(/(\d+)/);
    if (match) {
        return { inStock: parseInt(match[1]), lead: null };
    }
    
    return { inStock: 0, lead: stockStr };
}

function normalizePricing(pricing) {
    if (!pricing) return [];
    
    if (Array.isArray(pricing)) {
        return pricing
            .filter(p => p && typeof p === 'object')
            .map(p => ({
                qty: Number(p.qty) || 1,
                price: Number(p.price) || 0,
                currency: normalizeCurrency(p.currency),
                supplier: p.supplier || null
            }))
            .filter(p => p.price > 0);
    }
    
    if (typeof pricing === 'object' && pricing.price) {
        return [{
            qty: Number(pricing.qty) || 1,
            price: Number(pricing.price) || 0,
            currency: normalizeCurrency(pricing.currency),
            supplier: pricing.supplier || null
        }].filter(p => p.price > 0);
    }
    
    return [];
}

function normalizePackage(packageStr) {
    if (!packageStr) return null;
    return packageStr.toString().trim() || null;
}

function normalizePackaging(packagingStr) {
    if (!packagingStr) return null;
    return packagingStr.toString().trim() || null;
}

function normalizeUrl(url) {
    if (!url) return null;
    const urlStr = url.toString().trim();
    return urlStr.length > 0 ? urlStr : null;
}

function normalizeSuppliers(suppliers) {
    if (!Array.isArray(suppliers)) return [];
    
    return suppliers
        .filter(s => s && typeof s === 'object')
        .map(s => ({
            name: s.name || '',
            url: s.url || null,
            inStock: Number(s.inStock) || 0,
            pricing: normalizePricing(s.pricing || [])
        }))
        .filter(s => s.name.length > 0);
}

function normalizeTechnicalSpecs(specs) {
    if (!specs || typeof specs !== 'object') return {};
    
    const normalized = {};
    for (const [key, value] of Object.entries(specs)) {
        if (value !== null && value !== undefined) {
            normalized[key] = value.toString().trim();
        }
    }
    return normalized;
}

function normalizeCurrency(currency) {
    if (!currency) return 'USD';
    const currencyMap = {
        '$': 'USD',
        '€': 'EUR',
        '₽': 'RUB',
        'RUB': 'RUB',
        'USD': 'USD',
        'EUR': 'EUR'
    };
    return currencyMap[currency.toString().toUpperCase()] || 'USD';
}
