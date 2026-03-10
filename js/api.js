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

            if (!resp.ok) {
                // DO NOT auto-redirect to login on 401 globally.
                // It breaks guest access to public tracking.
                if (resp.status === 401) {
                    this._session = null;
                    localStorage.removeItem('safeall_token');
                }
                throw new Error(data.message || 'Server Error');
            }
            return data;
        } catch (e) {
            console.error(`[API FAIL] ${url}:`, e.message);
            throw e;
        }
    },

    // --- Session ---

    async initSession() {
        if (!localStorage.getItem('safeall_token')) {
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
            // No auto-logout here, let _fetch handle token clearing
            return null;
        }
        return null;
    },

    getActiveUser() {
        return this._session;
    },

    logout(forceRedirect = false) {
        this._session = null;
        localStorage.removeItem('safeall_token');
        localStorage.removeItem('safeall_active_user');

        if (forceRedirect && !window.location.pathname.includes('login.html')) {
            window.location.href = 'login.html';
        }
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

    async checkPhone(phone) {
        try {
            const res = await this._fetch(`user/check-phone?phone=${encodeURIComponent(phone)}`, {
                method: 'GET'
            });
            return { success: true, exists: res.exists };
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
            // res.orderId here is the short_id (e.g. SA-XXXXXX)
            return { success: true, orderId: res.orderId };
        } catch (e) {
            return {
                success: false,
                message: e.message || 'Lỗi xử lý đơn hàng'
            };
        }
    },

    async getMyOrders() {
        try {
            const res = await this._fetch('orders/my');
            return { success: true, orders: res.orders };
        } catch (e) {
            return { success: false, message: e.message };
        }
    },

    async trackOrderQuick(phone) {
        try {
            const res = await this._fetch('orders/track-quick', {
                method: 'POST',
                body: JSON.stringify({ phone })
            });
            return { success: true, orders: res.orders };
        } catch (e) {
            return { success: false, message: e.message };
        }
    },

    async trackOrderDetail(phone, pin) {
        try {
            const res = await this._fetch('orders/track-detail', {
                method: 'POST',
                body: JSON.stringify({ phone, pin })
            });
            return { success: true, orders: res.orders };
        } catch (e) {
            return { success: false, message: e.message };
        }
    },
    async updateOrderStatus(payload) {
        try {
            const res = await this._fetch('orders/status', {
                method: 'PATCH',
                body: JSON.stringify(payload)
            });
            return { success: true, message: res.message };
        } catch (e) {
            return { success: false, message: e.message };
        }
    },

    // --- Forgot PIN Flow (Token-based) ---
    async forgotPin(contact) {
        try {
            const res = await this._fetch('user/forgot-pin', {
                method: 'POST',
                body: JSON.stringify({ contact })
            });
            return { success: true, message: res.message };
        } catch (e) {
            return { success: false, message: e.message };
        }
    },

    async resetPin(phone, token, newPin) {
        try {
            return await this._fetch('user/reset-pin', {
                method: 'POST',
                body: JSON.stringify({ phone, token, newPin })
            });
        } catch (e) {
            return { success: false, message: e.message };
        }
    }
};

window.SAFEALL_API = API;
