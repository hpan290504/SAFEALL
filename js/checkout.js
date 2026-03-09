/**
 * js/checkout.js - REWRITTEN
 * 
 * Flow:
 * 1. Watch #custPhone. When 10 digits => API.checkPhone()
 * 2. Toggle Scenario A (Existing) or B (New)
 * 3. Handle Submit => API.createOrder()
 * 4. Render Cart summary.
 */

const Checkout = {
    isExistingUser: false,
    phoneChecked: false,

    init() {
        console.log('[Checkout] Initializing new flow...');
        this.renderSummary();
        this.bindEvents();
    },

    bindEvents() {
        const phoneInput = document.getElementById('custPhone');
        if (phoneInput) {
            phoneInput.addEventListener('input', (e) => this.handlePhoneInput(e.target.value));
            phoneInput.addEventListener('blur', (e) => this.handlePhoneInput(e.target.value, true));
        }

        const form = document.getElementById('checkoutForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.placeOrder();
            });
        }

        const forgotBtn = document.getElementById('btnForgotPin');
        if (forgotBtn) {
            forgotBtn.onclick = () => this.handleForgotPin();
        }
    },

    async handlePhoneInput(val, force = false) {
        const raw = val.replace(/\D/g, '');
        if (raw.length === 10 || (force && raw.length >= 9)) {
            if (this.lastCheckedPhone === raw) return;
            this.lastCheckedPhone = raw;

            this.showPinState('loading');
            try {
                const res = await window.SAFEALL_API.checkPhone(raw);
                if (res.success) {
                    this.isExistingUser = res.exists;
                    this.showPinState(res.exists ? 'existing' : 'new');
                    this.phoneChecked = true;
                }
            } catch (err) {
                console.error('[Checkout] Phone check failed:', err);
                this.showPinState('init');
            }
        } else {
            this.showPinState('init');
            this.phoneChecked = false;
        }
    },

    showPinState(state) {
        const elLoading = document.getElementById('pinLoading');
        const elInit = document.getElementById('pinInit');
        const elExisting = document.getElementById('pinExisting');
        const elNew = document.getElementById('pinNew');

        [elLoading, elInit, elExisting, elNew].forEach(el => el?.classList.add('hidden'));

        if (state === 'loading') elLoading?.classList.remove('hidden');
        else if (state === 'existing') elExisting?.classList.remove('hidden');
        else if (state === 'new') elNew?.classList.remove('hidden');
        else elInit?.classList.remove('hidden');
    },

    renderSummary() {
        const items = window.SAFEALL_CART?.getItems() || [];
        const container = document.getElementById('checkoutItems');
        if (!container) return;

        if (items.length === 0) {
            container.innerHTML = '<p class="text-center py-10 text-slate-400 font-bold">Giỏ hàng trống</p>';
            return;
        }

        let subtotal = 0;
        container.innerHTML = items.map(item => {
            const rowTotal = item.price * item.qty;
            subtotal += rowTotal;
            return `
                <div class="flex gap-4 group">
                    <div class="size-14 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden flex-shrink-0">
                        <img src="${item.image}" class="size-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    </div>
                    <div class="flex-1 min-w-0 py-1">
                        <p class="text-sm font-bold truncate">${item.title}</p>
                        <p class="text-[10px] text-slate-500 font-black uppercase tracking-widest">${item.qty}x ${window.SAFEALL_CART.formatPrice(item.price)}</p>
                    </div>
                    <div class="py-1 text-sm font-black text-primary">${window.SAFEALL_CART.formatPrice(rowTotal)}</div>
                </div>
            `;
        }).join('');

        const shipping = (subtotal > 0 && subtotal < 500000) ? 30000 : 0;
        const total = subtotal + shipping;

        document.getElementById('sumSubtotal').innerText = window.SAFEALL_CART.formatPrice(subtotal);
        document.getElementById('sumShipping').innerText = shipping === 0 ? 'Miễn phí' : window.SAFEALL_CART.formatPrice(shipping);
        document.getElementById('sumTotal').innerText = window.SAFEALL_CART.formatPrice(total);
    },

    async placeOrder() {
        if (!this.phoneChecked) {
            this.showError('Vui lòng nhập số điện thoại hợp lệ.');
            return;
        }

        const items = window.SAFEALL_CART.getItems();
        const customer = {
            name: document.getElementById('custName').value.trim(),
            phone: document.getElementById('custPhone').value.trim(),
            email: document.getElementById('custEmail').value.trim(),
            address: document.getElementById('custAddress').value.trim()
        };
        const note = document.getElementById('orderNote').value.trim();
        const paymentMethod = document.querySelector('input[name="payment"]:checked').value;

        // PIN logic
        let pin = '';
        if (this.isExistingUser) {
            pin = document.getElementById('inputPinVerify').value.trim();
            if (!pin || pin.length !== 6) {
                this.showError('Vui lòng nhập mã PIN (6 số) để xác nhận.');
                document.getElementById('inputPinVerify').focus();
                return;
            }
        } else {
            const p1 = document.getElementById('inputPinCreate').value.trim();
            const p2 = document.getElementById('inputPinConfirm').value.trim();
            if (!p1 || p1.length !== 6) {
                this.showError('Vui lòng tạo mã PIN mới (6 số).');
                document.getElementById('inputPinCreate').focus();
                return;
            }
            if (p1 !== p2) {
                this.showError('Mã PIN xác nhận không khớp.');
                document.getElementById('inputPinConfirm').focus();
                return;
            }
            pin = p1;
        }

        const subtotal = items.reduce((s, i) => s + (i.price * i.qty), 0);
        const shippingFee = (subtotal > 0 && subtotal < 500000) ? 30000 : 0;
        const total = subtotal + shippingFee;
        const orderId = 'SA' + Math.random().toString(36).substr(2, 6).toUpperCase();

        const payload = {
            orderId, items, subtotal, shippingFee, total,
            paymentMethod, note, customer, pin
        };

        const btn = document.getElementById('btnPlaceOrder');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="codicon codicon-loading animate-spin"></i> ĐANG XỬ LÝ...';

        try {
            const res = await window.SAFEALL_API.createOrder(payload);
            if (res.success) {
                localStorage.removeItem(window.SAFEALL_CART.storageKey);
                sessionStorage.setItem('safeall_last_order', JSON.stringify({ ...payload, success: true }));
                window.location.href = 'order-success.html';
            } else {
                let errorMsg = res.message || 'Lỗi xử lý đơn hàng';

                // Detailed debug info if available
                let debugInfo = [];
                if (res.code) debugInfo.push(`Postgres: ${res.code}`);
                if (res.step) debugInfo.push(`Giai đoạn: ${res.step}`);
                if (res.error) debugInfo.push(`Lỗi gốc: ${res.error}`);

                if (debugInfo.length > 0) {
                    errorMsg += `<div class="mt-2 pt-2 border-t border-red-200/50 text-[10px] opacity-70 italic">${debugInfo.join(' | ')}</div>`;
                }

                this.showError(errorMsg);
                btn.disabled = false;
                btn.innerHTML = originalText;
                if (res.retry) btn.innerHTML = 'NHẤN LẠI ĐẾ XÁC NHẬN <i class="codicon codicon-sync"></i>';
            }
        } catch (err) {
            this.showError('Lỗi kết nối máy chủ. Vui lòng thử lại.');
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    },

    showError(msg) {
        const el = document.getElementById('checkoutError');
        if (!el) return;
        el.innerHTML = msg;
        el.classList.remove('hidden');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => el.classList.add('hidden'), 10000);
    },

    async handleForgotPin() {
        const phone = document.getElementById('custPhone').value.trim();
        if (!phone) {
            this.showError('Vui lòng nhập số điện thoại trước khi yêu cầu khôi phục PIN.');
            return;
        }

        try {
            const res = await window.SAFEALL_API.forgotPin(phone);
            alert(res.message);
        } catch (err) {
            this.showError('Không thể gửi yêu cầu hỗ trợ lúc này.');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => Checkout.init());
