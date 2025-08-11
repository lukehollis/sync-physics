// Browser-compatible helper functions

// Browser-compatible inspect function for debugging
export function inspect(obj: any, options?: any): string {
    if (typeof obj === 'string') return obj;
    if (obj === null) return 'null';
    if (obj === undefined) return 'undefined';
    
    try {
        return JSON.stringify(obj, null, 2);
    } catch (e) {
        // Handle circular references or other JSON stringify errors
        return String(obj);
    }
}

// Browser-compatible UUID v4 generator
export function uuid(): string {
    // Use crypto.randomUUID if available (modern browsers)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    
    // Fallback to manual UUID v4 generation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
