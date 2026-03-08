// js/login.js - Production Authentication (Stateless)
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('unifiedLoginForm');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        if (!username || !password) return;

        const errorEl = document.getElementById('loginError');
        const showError = (msg) => {
            if (errorEl) { errorEl.textContent = msg; errorEl.classList.remove('hidden'); }
        };

        // CALL API - Only the token is persisted by the API module
        const result = await window.SAFEALL_API.login(username, password);

        if (!result.success) {
            showError(result.message);
            return;
        }

        // REDIRECT based on server-returned role
        const urlParams = new URLSearchParams(window.location.search);
        const redirectUrl = urlParams.get('redirect');

        if (redirectUrl) {
            window.location.href = redirectUrl;
        } else if (result.data.role === 'admin') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'my-orders.html';
        }
    });

    // Auto-redirect if already synced
    (async () => {
        const user = await window.SAFEALL_API.initSession();
        if (user) {
            const urlParams = new URLSearchParams(window.location.search);
            const redirectUrl = urlParams.get('redirect');
            if (redirectUrl) window.location.href = redirectUrl;
            else window.location.href = (user.role === 'admin') ? 'admin.html' : 'my-orders.html';
        }
    })();
});
