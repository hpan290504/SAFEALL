import bcrypt from 'bcryptjs';

/**
 * Verifies a PIN against a user's stored hashes.
 * Checks track_pin_hash first, then falls back to password for legacy support.
 */
export async function verifyPin(user, pin) {
    if (!user || !pin) return false;

    // Check dedicated tracking PIN first
    if (user.track_pin_hash) {
        const match = await bcrypt.compare(pin, user.track_pin_hash);
        if (match) return true;
    }

    // Fallback to legacy password if track_pin_hash didn't match or doesn't exist
    if (user.password) {
        return await bcrypt.compare(pin, user.password);
    }

    return false;
}

/**
 * Hashes a PIN using bcrypt.
 */
export async function hashPin(pin) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(pin, salt);
}
