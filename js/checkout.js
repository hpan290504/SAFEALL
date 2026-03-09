/**
 * SAFEALL Checkout management
 * Handles address pre-filling, order summary, and submission.
 */
window.SAFEALL_CHECKOUT = {
    /**
     * Pre-fill user data if logged in
     */
    async prefillData() {
        const user = await window.SAFEALL_API.initSession();
        if (user) {
            const nameEl = document.getElementById('checkoutFullName');
            const phoneEl = document.getElementById('checkoutPhone');
            const addrEl = document.getElementById('checkoutAddressDisplay');

            if (nameEl) nameEl.innerText = user.full_name || 'Guest User';
            if (phoneEl) phoneEl.innerText = user.phone || '';
            if (addrEl) addrEl.innerText = user.address || 'Chưa cập nhật địa chỉ';
        }
    },

    /**
     * Render order summary from cart
     */
    renderSummary() {
        const items = window.SAFEALL_CART.getItems();
        const container = document.getElementById('checkoutItemsTable');
        if (!container) return;

        let subtotal = 0;
        let html = '';

        items.forEach(item => {
            const itemTotal = item.price * item.qty;
            subtotal += itemTotal;
            html += `
                <tr class="item-row">
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-4">
                            <div class="h-20 w-20 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                                <img class="w-full h-full object-cover" src="${item.image}"/>
                            </div>
                            <div>
                                <p class="font-bold text-slate-900 dark:text-white">${item.title}</p>
                                <p class="text-xs text-slate-500">${item.category === 'flood' ? 'Premium Grade' : 'Standard'}</p>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4 text-center font-medium">${window.SAFEALL_CART.formatPrice(item.price)}</td>
                    <td class="px-6 py-4 text-center font-bold">${item.qty}</td>
                    <td class="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">${window.SAFEALL_CART.formatPrice(itemTotal)}</td>
                </tr>
            `;
        });

        container.innerHTML = html;

        const shipping = (subtotal > 0 && subtotal < 500000) ? 30000 : 0;
        const total = subtotal + shipping;

        document.getElementById('checkoutSubtotal').innerText = window.SAFEALL_CART.formatPrice(subtotal);
        document.getElementById('checkoutShipping').innerText = window.SAFEALL_CART.formatPrice(shipping);
        document.getElementById('checkoutTotal').innerText = window.SAFEALL_CART.formatPrice(total);

        // Count items
        const count = items.reduce((sum, i) => sum + i.qty, 0);
        const countLabels = document.querySelectorAll('.checkout-item-count');
        countLabels.forEach(el => el.innerText = `(${count} sản phẩm)`);
    },

    /**
     * Handle order submission
     */
    async placeOrder() {
        const items = window.SAFEALL_CART.getItems();
        if (items.length === 0) {
            alert("Giỏ hàng trống!");
            return;
        }

        const name = document.getElementById('checkoutFullName').innerText;
        const phone = document.getElementById('checkoutPhone').innerText;
        const address = document.getElementById('checkoutAddressDisplay').innerText;
        const note = document.getElementById('orderNote')?.value || '';
        const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value || 'cod';

        const subtotal = items.reduce((sum, i) => sum + (i.price * i.qty), 0);
        const shippingFee = (subtotal > 0 && subtotal < 500000) ? 30000 : 0;
        const total = subtotal + shippingFee;

        const orderId = 'SA' + Math.random().toString(36).substr(2, 6).toUpperCase();
        const newOrder = {
            orderId,
            customer: { name, phone, address },
            items: items.map(i => ({
                title: i.title,
                price: i.price,
                qty: i.qty,
                total: i.price * i.qty
            })),
            note,
            subtotal,
            shippingFee,
            total,
            paymentMethod
        };

        const btn = document.getElementById('placeOrderBtn');
        const originalText = btn.innerText;
        btn.innerText = 'Đang xử lý...';
        btn.disabled = true;

        try {
            const result = await window.SAFEALL_API.createOrder(newOrder);
            if (result.success) {
                localStorage.removeItem(window.SAFEALL_CART.storageKey);
                alert("Đặt hàng thành công! Mã đơn hàng: " + orderId);
                window.location.href = 'index.html';
            } else {
                alert("Lỗi: " + result.message);
                btn.innerText = originalText;
                btn.disabled = false;
            }
        } catch (e) {
            console.error(e);
            alert("Lỗi kết nối server.");
            btn.innerText = originalText;
            btn.disabled = false;
        }
    },

    init() {
        if (document.getElementById('checkoutItemsTable')) {
            this.prefillData();
            this.renderSummary();

            const btn = document.getElementById('placeOrderBtn');
            if (btn) {
                btn.onclick = () => this.placeOrder();
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => window.SAFEALL_CHECKOUT.init());
