// js/auth.js - Global Authentication UI Logic

document.addEventListener('DOMContentLoaded', () => {
    initAuthUI();
});

function initAuthUI() {
    const authSection = document.getElementById('authSection');
    if (!authSection) return;

    const activeSession = JSON.parse(localStorage.getItem('safeall_active_user'));

    if (activeSession) {
        // User logged in
        let avatarSrc = 'assets/avt_nam.jpg';
        if (activeSession.gender === 'female') {
            avatarSrc = 'assets/avt_nu.png';
        } else if (activeSession.role === 'admin') {
            avatarSrc = 'assets/avt_nam.jpg'; // default admin
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
        // Guest
        const currentParams = window.location.pathname.includes('login') ? '' : `?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;

        authSection.innerHTML = `
            <div class="guest-nav">
                <a href="login.html${currentParams}" class="auth-btn" data-i18n="nav_register">Đăng Ký</a>
                <span class="auth-divider">|</span>
                <a href="login.html${currentParams}" class="auth-btn" data-i18n="nav_login">Đăng Nhập</a>
            </div>
        `;
    }

    // Retrigger language update if function exists to translate dynamically added elements
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
    localStorage.removeItem('safeall_active_user');
    window.location.href = 'index.html';
}
