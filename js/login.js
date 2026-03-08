// login.js - Unified Form Authentication
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('unifiedLoginForm');

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        const gender = 'male'; // avatar mặc định avt_nam.jpg

        if (!username) return;

        // Validate: nếu không phải admin thì bắt buộc là số điện thoại 10 số
        if (!(username === 'admin' && password === 'admin')) {
            const phoneRegex = /^[0-9]{10}$/;
            if (!phoneRegex.test(username)) {
                showError('Số điện thoại phải gồm đúng 10 chữ số.');
                return;
            }
        }
        clearError();

        // Admin Auth Flow is handled inside API.login

        // User Auth Flow - Check against registered users via API
        const errorEl = document.getElementById('loginError');
        const showError = (msg) => {
            if (errorEl) { errorEl.textContent = msg; errorEl.classList.remove('hidden'); }
        };

        (async () => {
            const result = await window.SAFEALL_API.login(username, password);

            if (!result.success) {
                showError(result.message);
                return;
            }

            // Login success
            window.SAFEALL_API.setActiveUser(result.data);

            // Handle redirect
            const urlParams = new URLSearchParams(window.location.search);
            const redirectUrl = urlParams.get('redirect');

            if (redirectUrl) {
                window.location.href = redirectUrl;
            } else if (result.data.role === 'admin') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'my-orders.html';
            }
        })();
    });

    // Auto redirect if already logged in
    const activeSession = window.SAFEALL_API.getActiveUser();
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
