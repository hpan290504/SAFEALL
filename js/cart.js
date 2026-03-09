/**
 * SAFEALL Cart state management
 * Handles adding items, updating quantities, and local storage sync.
 */
window.SAFEALL_CART = {
    storageKey: 'safeall_cart',

    /**
     * Get all items from cart
     */
    getItems() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error("Cart retrieval error:", e);
            return [];
        }
    },

    /**
     * Save cart to localStorage
     */
    saveItems(items) {
        localStorage.setItem(this.storageKey, JSON.stringify(items));
        this.updateBadge();
    },

    /**
     * Add item to cart
     * @param {Object} product { id, title, price, image, category }
     */
    addItem(product) {
        let items = this.getItems();
        const existing = items.find(item => item.id === product.id);

        if (existing) {
            existing.qty += 1;
        } else {
            items.push({
                ...product,
                qty: 1
            });
        }

        this.saveItems(items);
        this.showAddedToast(product.title);
    },

    /**
     * Update item quantity
     */
    updateQty(productId, delta) {
        let items = this.getItems();
        const index = items.findIndex(i => i.id === productId);

        if (index !== -1) {
            items[index].qty += delta;
            if (items[index].qty <= 0) {
                items.splice(index, 1);
            }
            this.saveItems(items);
            this.renderCartUI();
        }
    },

    /**
     * Remove item
     */
    removeItem(productId) {
        let items = this.getItems();
        items = items.filter(i => i.id !== productId);
        this.saveItems(items);
        this.renderCartUI();
    },

    /**
     * Update Navbar badge
     */
    updateBadge() {
        const items = this.getItems();
        const totalQty = items.reduce((sum, item) => sum + item.qty, 0);

        // Update both modern and legacy badges
        const badges = document.querySelectorAll('.cart-badge, .cart-count, .nav-cart-count');
        badges.forEach(badge => {
            badge.innerText = totalQty;
            badge.style.display = totalQty > 0 ? 'flex' : 'none';
        });
    },

    /**
     * Show a simple toast Notification
     */
    showAddedToast(title) {
        const msg = window.currentLang === 'en'
            ? `Added ${title} to cart`
            : `Đã thêm ${title} vào giỏ hàng`;
        alert(msg); // Placeholder for a nicer toast UI later
    },

    /**
     * Render the Cart UI in cart.html
     */
    renderCartUI() {
        const container = document.getElementById('cartItemsContainer');
        if (!container) return;

        const items = this.getItems();
        if (items.length === 0) {
            container.innerHTML = `<div class="p-8 text-center text-slate-500">Giỏ hàng trống.</div>`;
            this.updateSummary(0);
            return;
        }

        // Group by category for the new UI if needed, or just list
        // The new UI uses categories: Flood Kit, Multi-hazard, etc.
        let html = '';
        const categories = [...new Set(items.map(i => i.category))];

        categories.forEach(cat => {
            const catItems = items.filter(i => i.category === cat);
            const catLabel = cat === 'flood' ? 'Bộ kit ứng phó lũ lụt' : (cat === 'multi' ? 'Bộ kit đa tình huống' : 'Trang thiết bị');

            html += `
                <div class="mb-8">
                    <h3 class="text-sm font-black uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
                        <span class="material-symbols-outlined text-lg">category</span>
                        ${catLabel}
                    </h3>
                    <div class="space-y-4">
            `;

            catItems.forEach(item => {
                html += `
                    <div class="flex items-center gap-4 p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 transition-colors">
                        <div class="h-20 w-20 flex-shrink-0 bg-slate-100 rounded-lg overflow-hidden">
                            <img class="h-full w-full object-cover" src="${item.image}"/>
                        </div>
                        <div class="flex-1">
                            <h4 class="font-bold">${item.title}</h4>
                            <p class="text-xs text-slate-500">${this.formatPrice(item.price)}</p>
                        </div>
                        <div class="text-right">
                            <p class="font-bold text-primary">${this.formatPrice(item.price * item.qty)}</p>
                            <div class="flex items-center gap-2 mt-2">
                                <button onclick="window.SAFEALL_CART.updateQty('${item.id}', -1)" class="p-1 text-slate-400 hover:text-primary"><span class="material-symbols-outlined text-sm">remove</span></button>
                                <span class="text-sm font-bold w-4 text-center">${item.qty}</span>
                                <button onclick="window.SAFEALL_CART.updateQty('${item.id}', 1)" class="p-1 text-slate-400 hover:text-primary"><span class="material-symbols-outlined text-sm">add</span></button>
                                <button onclick="window.SAFEALL_CART.removeItem('${item.id}')" class="ml-2 p-1 text-slate-300 hover:text-red-500"><span class="material-symbols-outlined text-sm">delete</span></button>
                            </div>
                        </div>
                    </div>
                `;
            });

            html += `</div></div>`;
        });

        container.innerHTML = html;
        this.updateSummary(items.reduce((sum, i) => sum + (i.price * i.qty), 0));
    },

    /**
     * Update summary prices
     */
    updateSummary(total) {
        const elements = document.querySelectorAll('.cart-total-price, .cart-order-total');
        elements.forEach(el => {
            el.innerText = this.formatPrice(total);
        });

        const countElements = document.querySelectorAll('.cart-total-count');
        const count = this.getItems().reduce((sum, i) => sum + i.qty, 0);
        countElements.forEach(el => {
            el.innerText = `(${count} sản phẩm)`;
        });
    },

    formatPrice(num) {
        return num.toLocaleString('vi-VN') + 'đ';
    },

    init() {
        this.updateBadge();
        if (document.getElementById('cartItemsContainer')) {
            this.renderCartUI();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => window.SAFEALL_CART.init());
