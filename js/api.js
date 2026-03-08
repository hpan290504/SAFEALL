/**
 * js/api.js - Production Centralized Data Access Layer (v2)
 * 
 * SOURCE OF TRUTH: Server-side Session (validated via JWT)
 * NO user data is stored in localStorage.
 */

const API = {
    // AUTHORITATIVE SESSION STATE (In-memory only)
    _session: null,

    // Helper for fetch with logging
    async _fetch(endpoint, options = {}) {
        const url = `/api/${endpoint}`;
        const token = localStorage.getItem('safeall_token'); // Only token allowed in local storage

        const defaultHeaders = {
            'Content-Type': 'application/json',
        };

        if (token) {
            defaultHeaders['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers: { ...defaultHeaders, ...options.headers }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Server returned error');
            }

            return data;
        } catch (error) {
            console.error(`[API Fetch Failure] ${url}:`, error.message);
            throw error;
        }
    },

    // --- Session Management ---

    async initSession() {
        const token = localStorage.getItem('safeall_token');
        if (!token) {
            this._session = null;
            return null;
        }

        try {
            const result = await this._fetch('auth/me');
            if (result.success) {
                this._session = result.user;
                return result.user;
            }
        } catch (error) {
            // If token is invalid or server is down, treat as logged out
            this._session = null;
            return null;
        }
        return null;
    },

    /**
     * getActiveUser() - Returns the in-memory session.
     * Use ONLY for UI rendering checks.
     */
    getActiveUser() {
        return this._session;
    },

    logout() {
        this._session = null;
        localStorage.removeItem('safeall_token');
        // Purge ALL legacy keys to prevent cross-device persistence bugs
        localStorage.removeItem('safeall_active_user');
        localStorage.removeItem('safeall_orders');
    },

    // --- User Operations ---

    async registerUser(userData) {
        try {
            const result = await this._fetch('auth/register', {
                method: 'POST',
                body: JSON.stringify(userData)
            });
            return { success: true, message: result.message };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    async login(phone, password) {
        try {
            const result = await this._fetch('auth/login', {
                method: 'POST',
                body: JSON.stringify({ phone, password })
            });

            if (result.success) {
                // Save ONLY the token
                localStorage.setItem('safeall_token', result.token);
                // Set in-memory session
                this._session = result.user;
                return { success: true, data: result.user };
            }
            return { success: false, message: 'Invalid credentials' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    // --- Order Operations ---

    async createOrder(orderData) {
        try {
            const result = await this._fetch('orders/create', {
                method: 'POST',
                body: JSON.stringify(orderData)
            });
            return { success: true, orderId: result.orderId };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    async getMyOrders() {
        try {
            const result = await this._fetch('orders/my');
            return { success: true, orders: result.orders };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
};

window.SAFEALL_API = API;
