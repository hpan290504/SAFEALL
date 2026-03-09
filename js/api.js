/**
 * js/api.js - Absolute Production Centralized Data Access Layer
 * 
 * SOURCE OF TRUTH: Server-side (JWT + PostgreSQL)
 */

const API = {
    // AUTHORITATIVE STATE IN-MEMORY
    _session: null,

    async _fetch(endpoint, options = {}) {
        const url = `/api/${endpoint}`;
        const token = localStorage.getItem('safeall_token');

        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        try {
            const resp = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.message || 'Server Error');
            return data;
        } catch (e) {
            console.error(`[API FAIL] ${url}:`, e.message);
            throw e;
        }
    },

    // --- Session ---

    async initSession() {
        const token = localStorage.getItem('safeall_token');
        if (!token) {
            this._session = null;
            return null;
        }
        try {
            const res = await this._fetch('auth/me');
            if (res.success) {
                this._session = res.user;
                return res.user;
            }
        } catch (e) {
            this.logout();
            return null;
        }
        return null;
    },

    getActiveUser() {
        return this._session;
    },

    logout() {
        this._session = null;
        localStorage.removeItem('safeall_token');
        // PURGE ALL LEGACY KEYS
        localStorage.removeItem('safeall_active_user');
        localStorage.removeItem('safeall_orders');
        localStorage.removeItem('safeall_checkout_form');
    },

    // --- Auth ---

    async login(phone, password) {
        try {
            const res = await this._fetch('auth/login', {
                method: 'POST',
                body: JSON.stringify({ phone, password })
            });
            if (res.success) {
                // SỰ THẬT: Chỉ lưu token. Dữ liệu user sẽ được lấy qua initSession()
                localStorage.setItem('safeall_token', res.token);
                this._session = res.user;
                return { success: true, data: res.user };
            }
            return { success: false, message: 'Sai thông tin đăng nhập' };
        } catch (e) {
            return { success: false, message: e.message };
        }
    },

    async registerUser(userData) {
        try {
            const res = await this._fetch('auth/register', {
                method: 'POST',
                body: JSON.stringify(userData)
            });
            return { success: true, message: res.message };
        } catch (e) {
            return { success: false, message: e.message };
        }
    },

    // --- Profile & User Data ---

    async updateProfile(profileData) {
        try {
            const res = await this._fetch('user/update-profile', {
                method: 'POST',
                body: JSON.stringify(profileData)
            });
            if (res.success) {
                // Cập nhật session in-memory để frontend phản ứng ngay lập tức
                if (this._session) {
                    this._session = { ...this._session, ...profileData };
                }
                return { success: true };
            }
            return { success: false, message: res.message };
        } catch (e) {
            return { success: false, message: e.message };
        }
    },

    // --- Orders ---

    async createOrder(orderData) {
        try {
            const res = await this._fetch('orders/create', {
                method: 'POST',
                body: JSON.stringify(orderData)
            });

            // Nếu đặt hàng thành công, ta xóa note local (nếu còn)
            localStorage.removeItem('safeall_checkout_form');

            return { success: true, orderId: res.orderId };
        } catch (e) {
            return { success: false, message: e.message };
        }
    },

    async getMyOrders() {
        try {
            const res = await this._fetch('orders/my');
            return { success: true, orders: res.orders };
        } catch (e) {
            return { success: false, message: e.message };
        }
    }
};

window.SAFEALL_API = API;
