export function normalizePhone(phone) {
    if (!phone) return '';

    // Remove all non-digits, including leading +
    let normalized = phone.toString().replace(/\D/g, '');

    // Handle Vietnam country code prefix
    // If it starts with 84, replace with 0
    if (normalized.startsWith('84')) {
        normalized = '0' + normalized.substring(2);
    }

    // Ensure it's exactly 10 digits if it starts with 0
    // (This might vary depending on VN phone standards, but usually 0x is 10 digits)
    if (normalized.startsWith('0') && normalized.length > 10) {
        // Handle cases where people might enter 084...
        if (normalized.startsWith('084')) {
            normalized = '0' + normalized.substring(3);
        }
    }

    return normalized;
}
