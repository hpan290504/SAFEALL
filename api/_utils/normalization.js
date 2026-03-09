/**
 * Robust phone number normalization for SAFEALL
 * - Strips all non-digits
 * - Converts 84 prefix to 0 (Vietnam standard)
 * - Ensures consistency between lookup and storage
 */
export function normalizePhone(phone) {
    if (!phone) return '';

    // Remove all non-digits
    let normalized = phone.toString().replace(/\D/g, '');

    // Handle Vietnam country code prefix
    // If it starts with 84, replace with 0
    if (normalized.startsWith('84') && normalized.length > 9) {
        normalized = '0' + normalized.substring(2);
    }

    return normalized;
}
