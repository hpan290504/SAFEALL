// js/sign_up.js - Registration logic (v2)
document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signupForm');
    if (!signupForm) return;

    const errorEl = document.getElementById('signupError');
    const successEl = document.getElementById('signupSuccess');

    const showError = (msg) => {
        if (errorEl) {
            errorEl.textContent = msg;
            errorEl.classList.remove('hidden');
        }
    };

    const showSuccess = (msg) => {
        if (successEl) {
            successEl.textContent = msg;
            successEl.classList.remove('hidden');
        }
    };

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (errorEl) errorEl.classList.add('hidden');
        if (successEl) successEl.classList.add('hidden');

        const name = document.getElementById('fullName').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const password = document.getElementById('password').value.trim();
        const confirmPw = document.getElementById('confirmPassword').value.trim();

        // Validation
        if (!name || !phone || !password) {
            showError('Vui lòng điền đầy đủ thông tin.');
            return;
        }

        if (password !== confirmPw) {
            showError('Mật khẩu xác nhận không khớp.');
            return;
        }

        const userData = { name, phone, password, gender: 'male' };

        // CALL SERVER API (The ONLY source of truth)
        const result = await window.SAFEALL_API.registerUser(userData);

        if (!result.success) {
            showError(result.message);
            return;
        }

        showSuccess('Đăng ký thành công! Đang chuyển đến trang đăng nhập...');

        // IMPORTANT: We DO NOT set any local session here.
        // The user MUST log in through the backend to establish a real session.
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
    });
});
