/**
 * SAFEALL Checkout – Guest-first, one-page flow
 */
window.SAFEALL_CHECKOUT = {

    /**
     * Pre-fill form if user is logged in (optional, does not block guest)
     */
    async prefillData() {
        try {
            const user = await window.SAFEALL_API.initSession();
            if (user) {
                const nameEl = document.getElementById('checkoutFullName');
                const phoneEl = document.getElementById('checkoutPhone');
                const addrEl = document.getElementById('checkoutAddress');
                if (nameEl && user.full_name) nameEl.value = user.full_name;
                if (phoneEl && user.phone) phoneEl.value = user.phone;
                if (addrEl && user.address) addrEl.value = user.address;
            }
        } catch (e) {
            // Guest checkout – no session is fine
            console.log('Guest checkout mode');
        }

        // Initialize PIN UI Progressive Disclosure logic
        const phoneInput = document.getElementById('checkoutPhone');
        if (phoneInput) {
            const handlePhoneInput = async () => {
                const phone = phoneInput.value.trim().replace(/\s/g, '');
                const newPinContainer = document.getElementById('newPinContainer');
                const existingPinContainer = document.getElementById('existingPinContainer');

                // Standard VN phone length is 10 digits
                if (phone.length >= 10) {
                    try {
                        const result = await window.SAFEALL_API.checkPhone(phone);
                        if (result.success) {
                            if (result.exists) {
                                newPinContainer.classList.add('hidden');
                                existingPinContainer.classList.remove('hidden');
                                window.SAFEALL_CHECKOUT.isExistingUser = true;
                            } else {
                                existingPinContainer.classList.add('hidden');
                                newPinContainer.classList.remove('hidden');
                                window.SAFEALL_CHECKOUT.isExistingUser = false;
                            }
                        }
                    } catch (err) {
                        console.error('Phone check failed', err);
                    }
                } else {
                    newPinContainer.classList.add('hidden');
                    existingPinContainer.classList.add('hidden');
                    window.SAFEALL_CHECKOUT.isExistingUser = undefined;
                }
            };

            // Re-check when losing focus
            phoneInput.addEventListener('blur', handlePhoneInput);

            // Check immediately if prefilled (e.g. from browser autocomplete or session)
            if (phoneInput.value) {
                handlePhoneInput();
            }
        }
    },

    /**
     * Render compact order items in the sidebar
     */
    renderSummary() {
        const items = window.SAFEALL_CART.getItems();
        const container = document.getElementById('checkoutItemsContainer');
        if (!container) return;

        if (items.length === 0) {
            container.innerHTML = `
                <div class="py-12 text-center text-slate-400">
                    <i class="codicon codicon-warning text-4xl mb-4"></i>
                    <p class="font-bold mb-2">Giỏ hàng của bạn đang trống</p>
                    <p class="text-xs mb-6 px-4">Vui lòng chọn sản phẩm trước khi thanh toán.</p>
                    <a href="products.html" class="inline-flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity">
                        <i class="codicon codicon-arrow-left"></i> Quay lại cửa hàng
                    </a>
                </div>
            `;
            this.updateTotals(0);

            // Disable order button
            const btn = document.getElementById('placeOrderBtn');
            if (btn) {
                btn.disabled = true;
                btn.classList.add('opacity-50', 'cursor-not-allowed');
            }
            return;
        }

        let subtotal = 0;
        let html = '';

        items.forEach(item => {
            const itemTotal = item.price * item.qty;
            subtotal += itemTotal;
            html += `
                <div class="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <div class="relative flex-shrink-0">
                        <div class="h-14 w-14 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <img class="w-full h-full object-cover" src="${item.image}" alt="${item.title}"/>
                        </div>
                        <span class="absolute -top-1.5 -right-1.5 bg-primary text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">${item.qty}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-bold truncate">${item.title}</p>
                        <p class="text-xs text-slate-500">${window.SAFEALL_CART.formatPrice(item.price)}</p>
                    </div>
                    <div class="text-sm font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        ${window.SAFEALL_CART.formatPrice(itemTotal)}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
        this.updateTotals(subtotal);
    },

    updateTotals(subtotal) {
        const shipping = (subtotal > 0 && subtotal < 500000) ? 30000 : 0;
        const total = subtotal + shipping;

        const subtotalEl = document.getElementById('checkoutSubtotal');
        const shippingEl = document.getElementById('checkoutShipping');
        const totalEl = document.getElementById('checkoutTotal');

        if (subtotalEl) subtotalEl.innerText = window.SAFEALL_CART.formatPrice(subtotal);
        if (shippingEl) shippingEl.innerText = shipping === 0 ? 'Miễn phí' : window.SAFEALL_CART.formatPrice(shipping);
        if (totalEl) totalEl.innerText = window.SAFEALL_CART.formatPrice(total);

        const countLabels = document.querySelectorAll('.checkout-item-count');
        const count = window.SAFEALL_CART.getItems().reduce((sum, i) => sum + i.qty, 0);
        countLabels.forEach(el => el.innerText = `(${count} sản phẩm)`);
    },

    /**
     * Validate and submit order
     */
    async placeOrder() {
        const items = window.SAFEALL_CART.getItems();
        if (items.length === 0) {
            this.showError('Giỏ hàng trống! Vui lòng quay lại cửa hàng để chọn sản phẩm.');
            return;
        }

        // Read from INPUT fields
        const name = document.getElementById('checkoutFullName').value.trim();
        const phone = document.getElementById('checkoutPhone').value.trim();
        const email = document.getElementById('checkoutEmail')?.value.trim() || '';
        const address = document.getElementById('checkoutAddress').value.trim();
        const note = document.getElementById('orderNote')?.value.trim() || '';
        const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value || 'cod';

        // Validate Basic Info
        if (!name) { this.showError('Vui lòng nhập họ và tên.'); document.getElementById('checkoutFullName').focus(); return; }
        if (!phone) { this.showError('Vui lòng nhập số điện thoại.'); document.getElementById('checkoutPhone').focus(); return; }
        if (!address) { this.showError('Vui lòng nhập địa chỉ giao hàng.'); document.getElementById('checkoutAddress').focus(); return; }

        // Grab and Validate PIN
        let pin = '';
        if (window.SAFEALL_CHECKOUT.isExistingUser === true) {
            pin = document.getElementById('pinExisting').value.trim();
            if (!pin || pin.length !== 6) {
                this.showError('Vui lòng nhập mã PIN hợp lệ (6 số) để xác nhận đơn hàng.');
                document.getElementById('pinExisting').focus();
                return;
            }
        } else if (window.SAFEALL_CHECKOUT.isExistingUser === false) {
            pin = document.getElementById('pinNew').value.trim();
            const pinConfirm = document.getElementById('pinConfirm').value.trim();
            if (!pin || pin.length !== 6) {
                this.showError('Vui lòng tạo mã PIN (6 số) để bảo mật đơn hàng.');
                document.getElementById('pinNew').focus();
                return;
            }
            if (pin !== pinConfirm) {
                this.showError('Mã PIN không khớp. Vui lòng nhập lại.');
                document.getElementById('pinConfirm').focus();
                return;
            }
        } else {
            this.showError('Vui lòng cung cấp số điện thoại hợp lệ trước khi thanh toán.');
            document.getElementById('checkoutPhone').focus();
            return;
        }

        const subtotal = items.reduce((sum, i) => sum + (i.price * i.qty), 0);
        const shippingFee = (subtotal > 0 && subtotal < 500000) ? 30000 : 0;
        const total = subtotal + shippingFee;
        const orderId = 'SA' + Math.random().toString(36).substr(2, 6).toUpperCase();

        const newOrder = {
            orderId,
            customer: { name, phone, address, email },
            items: items.map(i => ({ title: i.title, price: i.price, qty: i.qty, total: i.price * i.qty })),
            note,
            subtotal,
            shippingFee,
            total,
            paymentMethod,
            pin
        };

        const btn = document.getElementById('placeOrderBtn');
        btn.innerHTML = '<span class="animate-spin material-symbols-outlined text-sm">progress_activity</span> Đang xử lý...';
        btn.disabled = true;

        try {
            const result = await window.SAFEALL_API.createOrder(newOrder);
            if (result.success) {
                localStorage.removeItem(window.SAFEALL_CART.storageKey);
                // Redirect to success page with order info
                sessionStorage.setItem('safeall_last_order', JSON.stringify(newOrder));
                window.location.href = 'order-success.html';
            } else {
                let errorMsg = result.message || 'Lỗi xử lý đơn hàng';

                // Construct detailed debug info
                let debugParts = [];
                if (result.category) debugParts.push(`<b>Loại:</b> ${result.category}`);
                if (result.code) debugParts.push(`<b>Mã lỗi:</b> ${result.code}`);
                if (result.stage) debugParts.push(`<b>Giai đoạn:</b> ${result.stage}`);
                if (result.error) debugParts.push(`<b>Chi tiết:</b> ${result.error}`);

                let detailsHtml = debugParts.length > 0
                    ? `<div class="mt-2 pt-2 border-t border-red-200/50 text-[10px] leading-relaxed opacity-80">${debugParts.join(' | ')}</div>`
                    : '';

                if (result.tip) errorMsg += `<br/><small class="text-[11px] block mt-1 font-medium">${result.tip}</small>`;

                if (result.retry) {
                    // Specific UX for self-healing
                    this.showError(`${errorMsg}${detailsHtml}`, 'bg-blue-50 text-blue-600 border-blue-200');
                    btn.innerHTML = 'NHẤN LẠI ĐỂ XÁC NHẬN <i class="codicon codicon-sync"></i>';
                } else {
                    this.showError(`${errorMsg}${detailsHtml}`);
                    btn.innerHTML = 'XÁC NHẬN ĐƠN HÀNG <i class="codicon codicon-arrow-right group-hover:translate-x-1 transition-transform text-xl"></i>';
                }
                btn.disabled = false;
            }
        } catch (e) {
            console.error(e);
            this.showError('Hết phiên đăng nhập hoặc lỗi kết nối. Vui lòng kiểm tra internet và thử lại.');
            btn.innerHTML = 'XÁC NHẬN ĐƠN HÀNG <i class="codicon codicon-arrow-right group-hover:translate-x-1 transition-transform text-xl"></i>';
            btn.disabled = false;
        }
    },

    showError(msg, customClass = 'bg-red-50 text-red-600 border-red-200') {
        // Find or create an error banner above the order button
        let errBanner = document.getElementById('checkoutErrorBanner');
        if (!errBanner) {
            errBanner = document.createElement('div');
            errBanner.id = 'checkoutErrorBanner';
            errBanner.className = `w-full ${customClass} border text-sm font-bold p-4 rounded-xl mb-4 flex items-start gap-2 animate-in fade-in zoom-in-95 duration-200`;

            const btnContainer = document.getElementById('placeOrderBtn').parentElement;
            btnContainer.insertBefore(errBanner, document.getElementById('placeOrderBtn'));
        } else {
            errBanner.className = `w-full ${customClass} border text-sm font-bold p-4 rounded-xl mb-4 flex items-start gap-2`;
        }

        errBanner.innerHTML = `<i class="codicon codicon-info mt-0.5"></i> <span>${msg}</span>`;
        // Hide after 8 seconds
        setTimeout(() => { if (errBanner) errBanner.remove(); }, 8000);
    },

    init() {
        if (document.getElementById('checkoutItemsContainer')) {
            this.prefillData();
            this.renderSummary();
            const btn = document.getElementById('placeOrderBtn');
            if (btn) btn.onclick = () => this.placeOrder();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => window.SAFEALL_CHECKOUT.init());
