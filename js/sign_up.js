// sign_up.js - Registration logic for SAFEALL
document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signupForm');
    const errorEl = document.getElementById('signupError');
    const successEl = document.getElementById('signupSuccess');

    const showError = (msg) => {
        if (errorEl) {
            errorEl.textContent = msg;
            errorEl.classList.remove('hidden');
            setTimeout(() => errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
        }
    };

    const showSuccess = (msg) => {
        if (successEl) {
            successEl.textContent = msg;
            successEl.classList.remove('hidden');
        }
    };

    const clearMessages = () => {
        if (errorEl) errorEl.classList.add('hidden');
        if (successEl) successEl.classList.add('hidden');
    };

    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        clearMessages();

        const name = document.getElementById('fullName').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const password = document.getElementById('password').value.trim();
        const confirmPassword = document.getElementById('confirmPassword').value.trim();
        const terms = document.getElementById('terms').checked;

        // Validation
        if (!name || !phone || !password || !confirmPassword) {
            showError('Vui lòng điền đầy đủ thông tin.');
            return;
        }

        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(phone)) {
            showError('Số điện thoại phải gồm đúng 10 chữ số.');
            return;
        }

        if (password.length < 6) {
            showError('Mật khẩu phải có ít nhất 6 ký tự.');
            return;
        }

        if (password !== confirmPassword) {
            showError('Mật khẩu xác nhận không khớp.');
            return;
        }

        if (!terms) {
            showError('Bạn cần đồng ý với điều khoản dịch vụ.');
            return;
        }

        // Register via API
        (async () => {
            const userData = {
                name,
                phone,
                password,
                gender: 'male' // Mặc định như login.js đã thiết lập
            };

            const result = await window.SAFEALL_API.registerUser(userData);

            if (!result.success) {
                showError(result.message);
                return;
            }

            showSuccess('Đăng ký thành công! Hãy đăng nhập để tiếp tục.');

            // Redirect to login page for real session establishment
            setTimeout(() => {
                window.location.href = '../login.html';
            }, 2000);
        })();
    });
});
