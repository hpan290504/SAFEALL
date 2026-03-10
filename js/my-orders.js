// my-orders.js - Absolute Backend Sync (v2)
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Sync session with server (Source of Truth)
    const user = await window.SAFEALL_API.initSession();

    // 2. Auth Guard - Relaxed for Guest Tracking
    if (!user) {
        // Guest mode: Hide the tabs and personal labels, rely on the search bar in HTML
        const userLabel = document.getElementById('sidebarUserName');
        if (userLabel) userLabel.innerText = "Khách hàng";

        // Hide Tabs as guests only track specific orders
        const tabsRender = document.querySelector('.border-b.mb-8.overflow-x-auto');
        if (tabsRender) tabsRender.style.display = 'none';

        // Let the inline searchOrder() in HTML handle the rest when user searches
        const list = document.getElementById('userOrdersList');
        if (list) list.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:40px;">Đang ở chế độ khách. Vui lòng sử dụng <b>Tra cứu đơn hàng</b> phía trên bằng Mã đơn hoặc Số điện thoại.</td></tr>';

        return; // Stop authenticated fetch
    }

    // 3. UI Setup (Logged In)
    document.getElementById('sidebarUserName').innerText = user.name || user.phone;

    // 4. Source of Truth: Data already fetched from server via API.initSession()
    // 5. Fetch and Render
    loadOrdersFromServer('all');

    // Tabs
    document.querySelectorAll('.order-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.order-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            loadOrdersFromServer(tab.getAttribute('data-status'));
        });
    });
});

async function loadOrdersFromServer(status) {
    const list = document.getElementById('userOrdersList');
    if (!list) return;
    list.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">Đang tải từ máy chủ...</td></tr>';

    const res = await window.SAFEALL_API.getMyOrders();
    if (!res.success) {
        list.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:red;">Lỗi: ${res.message}</td></tr>`;
        return;
    }

    let orders = res.orders;
    if (status !== 'all') orders = orders.filter(o => o.fulfillment_status === status || o.payment_status === status);

    if (orders.length === 0) {
        list.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">Không có đơn hàng nào.</td></tr>';
        return;
    }

    list.innerHTML = orders.map(o => `
        <tr style="border-bottom:1px solid #eee;">
            <td style="padding:15px;">#${o.short_id}</td>
            <td style="padding:15px;">${new Date(o.created_at).toLocaleDateString('vi-VN')}</td>
            <td style="padding:15px;">${o.items?.map(i => i.title).join(', ') || 'Sản phẩm...'}</td>
            <td style="padding:15px;">${o.payment_method?.toUpperCase()}</td>
            <td style="padding:15px; font-weight:bold;">${new Intl.NumberFormat('vi-VN').format(o.total)}đ</td>
            <td style="padding:15px;"><span class="status-badge ${o.fulfillment_status}">${o.fulfillment_status === 'unfulfilled' ? 'Chờ xử lý' : 'Đã giao'}</span></td>
        </tr>
    `).join('');
}
