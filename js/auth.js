// js/auth.js - Global Authentication UI Logic (v2)

document.addEventListener('DOMContentLoaded', async () => {
    // ALWAYS sync with server before rendering ANY auth-dependent UI
    await window.SAFEALL_API.initSession();
    initAuthUI();
});

function initAuthUI() {
    const authSection = document.getElementById('authSection');
    if (!authSection) return;

    // Source of truth: in-memory session from server validation
    const activeSession = window.SAFEALL_API.getActiveUser();

    if (activeSession) {
        // User logged in
        let avatarSrc = 'assets/avt_nam.jpg';
        if (activeSession.gender === 'female') {
            avatarSrc = 'assets/avt_nu.png';
        } else if (activeSession.role === 'admin') {
            avatarSrc = 'assets/avt_nam.jpg';
        }

        authSection.innerHTML = `
            <div class="user-profile-nav">
                <img src="${avatarSrc}" alt="Avatar" class="nav-avatar">
                <span class="nav-username">${activeSession.identifier}</span>
                <div class="user-dropdown">
                    <a href="my-orders.html" data-i18n="nav_profile">Hồ sơ</a>
                    ${activeSession.role === 'admin' ? '<a href="admin.html" data-i18n="nav_admin">Quản trị</a>' : '<a href="my-orders.html" data-i18n="nav_orders">Đơn hàng</a>'}
                    <a href="#" onclick="logoutUser(event)" data-i18n="nav_logout">Đăng xuất</a>
                </div>
            </div>
        `;
    } else {
        // Guest - No session in memory
        const currentParams = window.location.pathname.includes('login') ? '' : `?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;

        authSection.innerHTML = `
            <div class="guest-nav">
                <a href="login.html${currentParams}" class="auth-btn" data-i18n="nav_register">Đăng Ký</a>
                <span class="auth-divider">|</span>
                <a href="login.html${currentParams}" class="auth-btn" data-i18n="nav_login">Đăng Nhập</a>
            </div>
        `;
    }

    if (typeof langData !== 'undefined' && typeof currentLang !== 'undefined' && document.documentElement.lang) {
        document.querySelectorAll('#authSection [data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (langData[document.documentElement.lang] && langData[document.documentElement.lang][key]) {
                el.innerHTML = langData[document.documentElement.lang][key];
            }
        });
    }
}

window.logoutUser = function (e) {
    if (e) e.preventDefault();
    window.SAFEALL_API.logout();
    window.location.href = 'index.html';
}
