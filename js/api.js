/**
 * js/api.js - Production Centralized Data Access Layer
 * 
 * Vercel Serverless Backend + PostgreSQL
 */

const API = {
    _session: null,

    // Helper for fetch with logging
    async _fetch(endpoint, options = {}) {
        const url = `/api/${endpoint}`;
        const token = localStorage.getItem('safeall_token');

        const defaultHeaders = {
            'Content-Type': 'application/json',
        };

        if (token) {
            defaultHeaders['Authorization'] = `Bearer ${token}`;
        }

        console.log(`[API Request] ${options.method || 'GET'} ${url}`);

        try {
            const response = await fetch(url, {
                ...options,
                headers: { ...defaultHeaders, ...options.headers }
            });

            const data = await response.json();

            if (!response.ok) {
                console.error(`[API Error] ${url}:`, data.message || response.statusText);
                throw new Error(data.message || 'Something went wrong');
            }

            return data;
        } catch (error) {
            console.error(`[API Fetch Failure] ${url}:`, error.message);
            throw error;
        }
    },

    // --- Session Management ---

    async initSession() {
        if (!localStorage.getItem('safeall_token')) {
            this._session = null;
            localStorage.removeItem('safeall_active_user');
            return null;
        }

        try {
            const result = await this._fetch('auth/me');
            if (result.success) {
                this._session = result.user;
                // Sync to localStorage for legacy code compatibility, but API._session is the real truth
                localStorage.setItem('safeall_active_user', JSON.stringify(result.user));
                return result.user;
            }
        } catch (error) {
            this.logout();
            return null;
        }
    },

    getActiveUser() {
        return this._session || JSON.parse(localStorage.getItem('safeall_active_user'));
    },

    logout() {
        this._session = null;
        localStorage.removeItem('safeall_active_user');
        localStorage.removeItem('safeall_token');
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
                localStorage.setItem('safeall_token', result.token);
                this._session = result.user;
                localStorage.setItem('safeall_active_user', JSON.stringify(result.user));
                return { success: true, data: result.user };
            }
            return { success: false, message: 'Login failed' };
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

// Export to window
window.SAFEALL_API = API;
