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
    },

    /**
     * Render compact order items in the sidebar
     */
    renderSummary() {
        const items = window.SAFEALL_CART.getItems();
        const container = document.getElementById('checkoutItemsContainer');
        if (!container) return;

        if (items.length === 0) {
            container.innerHTML = '<p class="text-sm text-slate-400 text-center py-4">Giỏ hàng trống</p>';
            this.updateTotals(0);
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
            alert('Giỏ hàng trống!');
            return;
        }

        // Read from INPUT fields
        const name = document.getElementById('checkoutFullName').value.trim();
        const phone = document.getElementById('checkoutPhone').value.trim();
        const address = document.getElementById('checkoutAddress').value.trim();
        const note = document.getElementById('orderNote')?.value.trim() || '';
        const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value || 'cod';

        // Validate
        if (!name) { alert('Vui lòng nhập họ và tên.'); document.getElementById('checkoutFullName').focus(); return; }
        if (!phone) { alert('Vui lòng nhập số điện thoại.'); document.getElementById('checkoutPhone').focus(); return; }
        if (!address) { alert('Vui lòng nhập địa chỉ giao hàng.'); document.getElementById('checkoutAddress').focus(); return; }

        const subtotal = items.reduce((sum, i) => sum + (i.price * i.qty), 0);
        const shippingFee = (subtotal > 0 && subtotal < 500000) ? 30000 : 0;
        const total = subtotal + shippingFee;
        const orderId = 'SA' + Math.random().toString(36).substr(2, 6).toUpperCase();

        const newOrder = {
            orderId,
            customer: { name, phone, address },
            items: items.map(i => ({ title: i.title, price: i.price, qty: i.qty, total: i.price * i.qty })),
            note,
            subtotal,
            shippingFee,
            total,
            paymentMethod
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
                alert('Lỗi: ' + result.message);
                btn.innerHTML = 'XÁC NHẬN ĐƠN HÀNG <span class="material-symbols-outlined">chevron_right</span>';
                btn.disabled = false;
            }
        } catch (e) {
            console.error(e);
            alert('Lỗi kết nối server. Vui lòng thử lại.');
            btn.innerHTML = 'XÁC NHẬN ĐƠN HÀNG <span class="material-symbols-outlined">chevron_right</span>';
            btn.disabled = false;
        }
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
