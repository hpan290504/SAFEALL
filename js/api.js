/**
 * js/api.js - Centralized Data Access Layer
 * 
 * This module abstracts data storage operations. 
 * Currently it uses localStorage for demonstration, 
 * but can be easily swapped for Firebase, Supabase, or any REST API.
 */

const API = {
    // --- User Operations ---

    /**
     * Get all registered users
     * @returns {Promise<Array>}
     */
    async getUsers() {
        // Simulate network delay
        return new Promise((resolve) => {
            setTimeout(() => {
                const users = JSON.parse(localStorage.getItem('safeall_users')) || [];
                resolve(users);
            }, 300);
        });
    },

    /**
     * Register a new user
     * @param {Object} userData 
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async registerUser(userData) {
        return new Promise(async (resolve) => {
            const users = await this.getUsers();

            if (users.find(u => u.phone === userData.phone)) {
                resolve({ success: false, message: 'Số điện thoại này đã được đăng ký.' });
                return;
            }

            users.push({
                ...userData,
                role: 'user',
                createdAt: new Date().toISOString()
            });

            localStorage.setItem('safeall_users', JSON.stringify(users));
            resolve({ success: true, message: 'Đăng ký thành công!' });
        });
    },

    /**
     * Login user
     * @param {string} phone 
     * @param {string} password 
     * @returns {Promise<{success: boolean, data?: Object, message?: string}>}
     */
    async login(phone, password) {
        return new Promise(async (resolve) => {
            // Admin default check
            if (phone === 'admin' && password === 'admin') {
                const adminData = {
                    role: 'admin',
                    identifier: 'admin',
                    gender: 'male',
                    name: 'Administrator'
                };
                resolve({ success: true, data: adminData });
                return;
            }

            const users = await this.getUsers();
            const foundUser = users.find(u => u.phone === phone);

            if (!foundUser) {
                resolve({ success: false, message: 'Số điện thoại chưa được đăng ký.' });
                return;
            }

            if (foundUser.password !== password) {
                resolve({ success: false, message: 'Mật khẩu không chính xác.' });
                return;
            }

            const sessData = {
                role: foundUser.role,
                identifier: foundUser.phone,
                name: foundUser.name,
                gender: foundUser.gender || 'male'
            };

            resolve({ success: true, data: sessData });
        });
    },

    // --- Session Management ---

    setActiveUser(userData) {
        localStorage.setItem('safeall_active_user', JSON.stringify(userData));
    },

    getActiveUser() {
        return JSON.parse(localStorage.getItem('safeall_active_user'));
    },

    logout() {
        localStorage.removeItem('safeall_active_user');
    }
};

// Export to window for access in other scripts without ES modules (for simplicity in current architecture)
window.SAFEALL_API = API;
