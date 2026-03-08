// my-orders.js - Production Ready (v2)
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Sync session with server (Source of Truth)
    const activeSession = await window.SAFEALL_API.initSession();

    // 2. Auth Guard - No local session = redirect to login
    if (!activeSession) {
        window.location.href = 'login.html';
        return;
    }

    // 3. UI Setup
    document.getElementById('sidebarUserName').innerText = activeSession.identifier;

    // Legacy Cleanup: ensure no localStorage orders are being read
    localStorage.removeItem('safeall_orders');

    // 4. Load Orders from API
    loadMyOrdersFromServer('all');

    // Tab Logic
    const tabs = document.querySelectorAll('.order-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            loadMyOrdersFromServer(tab.getAttribute('data-status'));
        });
    });
});

async function loadMyOrdersFromServer(filterStatus) {
    const container = document.getElementById('userOrdersList');
    if (!container) return;

    container.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">Đang tải đơn hàng...</td></tr>';

    const result = await window.SAFEALL_API.getMyOrders();

    if (!result.success) {
        container.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:red;">Lỗi tải đơn hàng: ${result.message}</td></tr>`;
        return;
    }

    let orders = result.orders;
    if (filterStatus !== 'all') {
        orders = orders.filter(o => o.status === filterStatus);
    }

    if (orders.length === 0) {
        container.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">Chưa có đơn hàng nào.</td></tr>';
        return;
    }

    container.innerHTML = orders.map(order => `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding:15px;">#${order.id.toUpperCase()}</td>
            <td style="padding:15px;">${new Date(order.date).toLocaleDateString('vi-VN')}</td>
            <td style="padding:15px;">${order.items.map(i => i.title).join(', ')}</td>
            <td style="padding:15px;">${order.paymentMethod === 'cod' ? 'COD' : 'Online'}</td>
            <td style="padding:15px; font-weight:bold;">${new Intl.NumberFormat('vi-VN').format(order.total)}đ</td>
            <td style="padding:15px;"><span class="status-badge ${order.status}">${order.status}</span></td>
        </tr>
    `).join('');
}
