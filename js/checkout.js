/**
 * js/checkout.js - Professional Multi-step Flow
 */

const Checkout = {
    currentStep: 1,
    isExistingUser: false,
    phoneChecked: false,
    lastCheckedPhone: '',

    init() {
        console.log('[Checkout] Initializing multi-step flow...');
        this.renderSummary();
        this.bindEvents();
        this.updateStepperUI();
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
    },

    updateStepperUI() {
        const indicators = document.querySelectorAll('.step-indicator');
        const stepLine = document.getElementById('stepLine');
        const progress = ((this.currentStep - 1) / (indicators.length - 1)) * 100;

        if (stepLine) stepLine.style.width = `${progress}%`;

        indicators.forEach(el => {
            const step = parseInt(el.dataset.step);
            const circle = el.querySelector('div');
            const label = el.querySelector('span');

            if (step < this.currentStep) {
                // Completed
                circle.classList.remove('border-primary', 'text-primary', 'border-slate-200', 'text-slate-400');
                circle.classList.add('bg-primary', 'border-primary', 'text-white');
                circle.innerHTML = '<i class="codicon codicon-check"></i>';
                label.classList.add('text-primary');
                label.classList.remove('text-slate-400');
            } else if (step === this.currentStep) {
                // Active
                circle.classList.remove('bg-primary', 'text-white', 'border-slate-200', 'text-slate-400');
                circle.classList.add('border-primary', 'text-primary');
                circle.innerHTML = step;
                label.classList.add('text-primary');
                label.classList.remove('text-slate-400');
            } else {
                // Future
                circle.classList.remove('bg-primary', 'border-primary', 'text-white', 'text-primary');
                circle.classList.add('border-slate-200', 'text-slate-400');
                circle.innerHTML = step;
                label.classList.remove('text-primary');
                label.classList.add('text-slate-400');
            }
        });

        // Toggle Sections
        document.querySelectorAll('.step-section').forEach(sec => sec.classList.add('hidden'));
        document.getElementById(`stepSection${this.currentStep}`).classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    nextStep(step) {
        if (this.validateStep(step)) {
            if (step === 3) this.prepareReview();
            this.currentStep++;
            this.updateStepperUI();
        }
    },

    prevStep(step) {
        this.currentStep--;
        this.updateStepperUI();
    },

    validateStep(step) {
        this.hideError();

        if (step === 1) {
            const name = document.getElementById('custName').value.trim();
            const phone = document.getElementById('custPhone').value.trim();
            const email = document.getElementById('custEmail').value.trim();

            if (!this.phoneChecked || phone.length < 10) {
                this.showError('Vui lòng nhập số điện thoại hợp lệ.');
                return false;
            }

            // PIN Validation
            if (this.isExistingUser) {
                const pin = document.getElementById('inputPinVerify').value.trim();
                if (pin.length !== 6) {
                    this.showError('Vui lòng nhập mã PIN 6 số.');
                    return false;
                }
            } else {
                const p1 = document.getElementById('inputPinCreate').value.trim();
                const p2 = document.getElementById('inputPinConfirm').value.trim();
                if (p1.length !== 6) {
                    this.showError('Vui lòng tạo mã PIN 6 số.');
                    return false;
                }
                if (p1 !== p2) {
                    this.showError('Mã PIN xác nhận không khớp.');
                    return false;
                }
            }

            if (!name) {
                this.showError('Vui lòng nhập họ tên.');
                return false;
            }
            if (!email || !email.includes('@')) {
                this.showError('Vui lòng nhập email hợp lệ để nhận hóa đơn.');
                return false;
            }
        }

        if (step === 2) {
            const address = document.getElementById('custAddress').value.trim();
            if (address.length < 10) {
                this.showError('Vui lòng nhập địa chỉ giao hàng chi tiết.');
                return false;
            }
        }

        return true;
    },

    prepareReview() {
        document.getElementById('reviewName').innerText = document.getElementById('custName').value;
        document.getElementById('reviewPhone').innerText = document.getElementById('custPhone').value;
        document.getElementById('reviewAddress').innerText = document.getElementById('custAddress').value;
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
        const btn = document.getElementById('btnPlaceOrder');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="codicon codicon-loading animate-spin"></i> ĐANG TẠO ĐƠN...';

        try {
            const items = window.SAFEALL_CART.getItems();
            const customer = {
                name: document.getElementById('custName').value.trim(),
                phone: document.getElementById('custPhone').value.trim(),
                email: document.getElementById('custEmail').value.trim(),
                address: document.getElementById('custAddress').value.trim()
            };
            const note = document.getElementById('orderNote').value.trim();
            const paymentMethod = document.querySelector('input[name="payment"]:checked').value;

            let pin = this.isExistingUser
                ? document.getElementById('inputPinVerify').value.trim()
                : document.getElementById('inputPinCreate').value.trim();

            const subtotal = items.reduce((s, i) => s + (i.price * i.qty), 0);
            const shippingFee = (subtotal > 0 && subtotal < 500000) ? 30000 : 0;
            const total = subtotal + shippingFee;

            const payload = {
                items, subtotal, shippingFee, total,
                paymentMethod, note, customer, pin,
                clientToken: `CT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
            };

            console.log('[Checkout] Payload sent:', payload);

            const res = await window.SAFEALL_API.createOrder(payload);
            if (res.success) {
                console.log('[Checkout] Order created successfully:', res.orderId);
                window.SAFEALL_CART.clear();
                sessionStorage.setItem('safeall_last_order', JSON.stringify({
                    orderId: res.orderId,
                    total,
                    date: new Date().toISOString(),
                    customer,
                    items
                }));
                window.location.href = 'order-success.html';
            } else {
                console.warn('[Checkout] Order creation failed:', res.message);
                this.showError(res.message || 'Lỗi không xác định khi tạo đơn hàng.');
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        } catch (err) {
            console.error('[Checkout] Fatal error:', err);
            const errMsg = err.message || 'Lỗi kết nối máy chủ. Vui lòng thử lại.';
            this.showError(errMsg);
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
    },

    hideError() {
        const el = document.getElementById('checkoutError');
        if (el) el.classList.add('hidden');
    }
};

document.addEventListener('DOMContentLoaded', () => Checkout.init());
