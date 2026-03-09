export function normalizePhone(phone) {
    if (!phone) return '';

    // Remove all non-digits
    let digits = phone.toString().replace(/\D/g, '');

    // Handle 84 prefix (Vietnam)
    if (digits.startsWith('84') && digits.length > 9) {
        digits = '0' + digits.substring(2);
    }

    // If it doesn't start with 0 but is 9 digits, add 0
    if (!digits.startsWith('0') && digits.length === 9) {
        digits = '0' + digits;
    }

    // Final check: must start with 0 and be 10 digits
    // If it's still not 10 digits, we return as is but the system should ideally reject it later
    return digits;
}
