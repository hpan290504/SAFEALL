// login.js - Unified Form Authentication
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('unifiedLoginForm');

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        const gender = 'male'; // avatar mặc định avt_nam.jpg

        if (!username) return;

        // Hiển thị lỗi lên UI nếu có
        const errorEl = document.getElementById('loginError');
        const showError = (msg) => {
            if (errorEl) { errorEl.textContent = msg; errorEl.classList.remove('hidden'); }
        };
        const clearError = () => { if (errorEl) errorEl.classList.add('hidden'); };

        // Validate: nếu không phải admin thì bắt buộc là số điện thoại 10 số
        if (!(username === 'admin' && password === 'admin')) {
            const phoneRegex = /^[0-9]{10}$/;
            if (!phoneRegex.test(username)) {
                showError('Số điện thoại phải gồm đúng 10 chữ số.');
                return;
            }
        }
        clearError();

        // Admin Auth Flow
        if (username === 'admin' && password === 'admin') {
            localStorage.setItem('safeall_active_user', JSON.stringify({
                role: 'admin',
                identifier: 'admin',
                gender: 'male'
            }));
            window.location.href = 'admin.html';
            return;
        }

        // User Auth Flow - Check against registered users
        const users = JSON.parse(localStorage.getItem('safeall_users')) || [];
        const foundUser = users.find(u => u.phone === username);

        if (!foundUser) {
            showError('Số điện thoại chưa được đăng ký.');
            return;
        }

        if (foundUser.password !== password) {
            showError('Mật khẩu không chính xác.');
            return;
        }

        // Login success
        localStorage.setItem('safeall_active_user', JSON.stringify({
            role: 'user',
            identifier: foundUser.phone,
            name: foundUser.name,
            gender: foundUser.gender || 'male'
        }));

        // Handle redirect
        const urlParams = new URLSearchParams(window.location.search);
        const redirectUrl = urlParams.get('redirect');

        if (redirectUrl) {
            window.location.href = redirectUrl;
        } else if (username === 'admin' && password === 'admin') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'my-orders.html';
        }
    });

    // Auto redirect if already logged in
    const activeSession = JSON.parse(localStorage.getItem('safeall_active_user'));
    if (activeSession) {
        const urlParams = new URLSearchParams(window.location.search);
        const redirectUrl = urlParams.get('redirect');

        if (redirectUrl) {
            window.location.href = redirectUrl;
        } else if (activeSession.role === 'admin') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'my-orders.html';
        }
    }
});
