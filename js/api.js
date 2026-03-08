/**
 * js/api.js - Production Centralized Data Access Layer
 * 
 * This module connects to the Vercel Serverless Backend.
 */

const API = {
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

    // --- User Operations ---

    /**
     * Register a new user
     * @param {Object} userData 
     * @returns {Promise<{success: boolean, message: string}>}
     */
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

    /**
     * Login user
     * @param {string} phone 
     * @param {string} password 
     * @returns {Promise<{success: boolean, data?: Object, message?: string}>}
     */
    async login(phone, password) {
        try {
            const result = await this._fetch('auth/login', {
                method: 'POST',
                body: JSON.stringify({ phone, password })
            });

            if (result.success) {
                // Store token for subsequent requests
                localStorage.setItem('safeall_token', result.token);
                return { success: true, data: result.user };
            }
            return { success: false, message: 'Login failed' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    // --- Session Management ---

    setActiveUser(userData) {
        localStorage.setItem('safeall_active_user', JSON.stringify(userData));
    },

    getActiveUser() {
        return JSON.parse(localStorage.getItem('safeall_active_user'));
    },

    async checkSession() {
        try {
            const result = await this._fetch('auth/me');
            return result.success;
        } catch {
            this.logout();
            return false;
        }
    },

    logout() {
        localStorage.removeItem('safeall_active_user');
        localStorage.removeItem('safeall_token');
    }
};

// Export to window
window.SAFEALL_API = API;
