import { normalizeProduct } from './normalize.js';

// Слияние результатов поиска по нормализованному MPN
export function mergeSearchResults(results) {
    const merged = new Map();
    
    for (const result of results) {
        const normalized = normalizeProduct(result);
        const mpn = normalized.mpn;
        
        if (!mpn) continue;
        
        if (merged.has(mpn)) {
            const existing = merged.get(mpn);
            mergeProducts(existing, normalized);
        } else {
            merged.set(mpn, normalized);
        }
    }
    
    return Array.from(merged.values());
}

function mergeProducts(existing, newProduct) {
    // Объединяем описания (берем более длинное)
    if (newProduct.description && newProduct.description.length > existing.description.length) {
        existing.description = newProduct.description;
    }
    
    // Объединяем изображения (дедупликация)
    const allImages = [...existing.images, ...newProduct.images];
    existing.images = [...new Set(allImages)];
    
    // Объединяем datasheets (дедупликация)
    const allDatasheets = [...existing.datasheets, ...newProduct.datasheets];
    existing.datasheets = [...new Set(allDatasheets)];
    
    // Объединяем цены (дедупликация по qty)
    const priceMap = new Map();
    [...existing.pricing, ...newProduct.pricing].forEach(price => {
        const key = `${price.qty}-${price.currency}`;
        if (!priceMap.has(key) || price.price < priceMap.get(key).price) {
            priceMap.set(key, price);
        }
    });
    existing.pricing = Array.from(priceMap.values()).sort((a, b) => a.qty - b.qty);
    
    // Объединяем availability (берем максимальное количество)
    if (newProduct.availability.inStock > existing.availability.inStock) {
        existing.availability = newProduct.availability;
    }
    
    // Объединяем package/packaging (берем непустое)
    if (newProduct.package && !existing.package) {
        existing.package = newProduct.package;
    }
    if (newProduct.packaging && !existing.packaging) {
        existing.packaging = newProduct.packaging;
    }
    
    // Объединяем suppliers (дедупликация по name)
    const supplierMap = new Map();
    [...existing.suppliers, ...newProduct.suppliers].forEach(supplier => {
        if (!supplierMap.has(supplier.name)) {
            supplierMap.set(supplier.name, supplier);
        }
    });
    existing.suppliers = Array.from(supplierMap.values());
    
    // Объединяем technical_specs (приоритет новым данным)
    existing.technical_specs = { ...existing.technical_specs, ...newProduct.technical_specs };
    
    // Объединяем URL (приоритет новому)
    if (newProduct.url) {
        existing.url = newProduct.url;
    }
}
