// js/sign_up.js - Registration logic (Absolute Stateless)
document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signupForm');
    if (!signupForm) return;

    const errorEl = document.getElementById('signupError');
    const successEl = document.getElementById('signupSuccess');

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (errorEl) errorEl.classList.add('hidden');
        if (successEl) successEl.classList.add('hidden');

        const name = document.getElementById('fullName').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const password = document.getElementById('password').value.trim();

        if (!name || !phone || !password) {
            if (errorEl) { errorEl.textContent = "Vui lòng điền đủ thông tin"; errorEl.classList.remove('hidden'); }
            return;
        }

        // AUTHENTIC API CALL
        const result = await window.SAFEALL_API.registerUser({ name, phone, password, gender: 'male' });

        if (!result.success) {
            if (errorEl) { errorEl.textContent = result.message; errorEl.classList.remove('hidden'); }
            return;
        }

        if (successEl) { successEl.textContent = "Đăng ký thành công! Hãy đăng nhập."; successEl.classList.remove('hidden'); }

        // REDIRECT TO LOGIN (FORCE REAL AUTH)
        setTimeout(() => { window.location.href = '/login.html'; }, 1500);
    });
});
