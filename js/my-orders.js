// my-orders.js - Production Ready (Backend Sync)
document.addEventListener('DOMContentLoaded', async () => {
    // Sync session first
    const activeSession = await window.SAFEALL_API.initSession();

    // Auth Guard
    if (!activeSession || activeSession.role !== 'user') {
        window.location.href = 'login.html';
        return;
    }

    // Set greeting & Avatar
    document.getElementById('sidebarUserName').innerText = activeSession.identifier;

    let avatarSrc = 'assets/avt_nam.jpg'; // default
    if (activeSession.gender === 'female') {
        avatarSrc = 'assets/avt_nu.png';
    }

    const avatarContainer = document.getElementById('sidebarAvatarContainer');
    if (avatarContainer) {
        avatarContainer.innerHTML = `<img src="${avatarSrc}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;">`;
    }

    // Load initial orders
    loadMyOrders(activeSession.identifier, 'all');

    // Tab Logic
    const tabs = document.querySelectorAll('.order-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const status = tab.getAttribute('data-status');
            loadMyOrders(activeSession.identifier, status);
        });
    });

    // Basic search functionality
    document.getElementById('orderSearch').addEventListener('input', function (e) {
        const query = e.target.value.toLowerCase();
        const activeTabStatus = document.querySelector('.order-tab.active').getAttribute('data-status');
        loadMyOrders(activeSession.identifier, activeTabStatus, query);
    });
});

function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
}

async function loadMyOrders(userPhone, filterStatus, searchQuery = '') {
    const container = document.getElementById('userOrdersList');
    const emptyMsg = document.getElementById('emptyOrdersMsg');
    const tableEl = document.getElementById('ordersTable');

    // Show loading state if needed
    container.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center;">Đang tải đơn hàng...</td></tr>';

    const result = await window.SAFEALL_API.getMyOrders();

    if (!result.success) {
        container.innerHTML = `<tr><td colspan="6" style="padding: 20px; text-align: center; color: red;">Lỗi: ${result.message}</td></tr>`;
        return;
    }

    let myOrders = result.orders;

    // Apply Tab Filter
    if (filterStatus !== 'all') {
        myOrders = myOrders.filter(o => o.status === filterStatus ||
            (filterStatus === 'delivering' && o.status === 'pending') // Keep legacy visual mapping
        );
    }

    // Apply Search Query
    if (searchQuery) {
        myOrders = myOrders.filter(o => {
            const matchesId = o.id.toLowerCase().includes(searchQuery);
            const matchesItems = o.items.some(i => i.title.toLowerCase().includes(searchQuery));
            return matchesId || matchesItems;
        });
    }

    if (myOrders.length === 0) {
        tableEl.style.display = 'none';
        emptyMsg.style.display = 'block';
        return;
    }

    emptyMsg.style.display = 'none';
    tableEl.style.display = 'table';

    // Generate Table Rows
    const html = myOrders.map(order => {
        const statusMap = {
            'pending': { text: 'Chờ xử lý', color: 'bg-warning text-dark', bgColor: '#ffc107' },
            'shipping': { text: 'Đang giao', color: 'bg-info text-white', bgColor: '#17a2b8' },
            'delivering': { text: 'Chờ giao hàng', color: 'bg-info text-white', bgColor: '#17a2b8' },
            'completed': { text: 'Hoàn thành', color: 'bg-success text-white', bgColor: '#28a745' },
            'cancelled': { text: 'Đã hủy', color: 'bg-danger text-white', bgColor: '#dc3545' },
            'returned': { text: 'Đã trả hàng', color: 'bg-danger text-white', bgColor: '#dc3545' }
        };

        const statusInfo = statusMap[order.status] || { text: order.status, color: 'bg-secondary text-white', bgColor: '#6c757d' };
        const dateStr = order.date ? new Date(order.date).toLocaleString('vi-VN') : 'Unknown';
        const itemsSummary = order.items.map(i => `${i.title} (x${i.qty})`).join(', ');

        return `
            <tr style="border-bottom: 1px solid #efefef;">
                <td style="padding: 15px; font-weight: 600; color: #444;">#${order.id.toUpperCase()}</td>
                <td style="padding: 15px; color: #666;">${dateStr}</td>
                <td style="padding: 15px; color: #666; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${itemsSummary}">${itemsSummary}</td>
                <td style="padding: 15px;"><span style="background: var(--primary-blue, #0055aa); color: #fff; padding: 4px 10px; border-radius: 4px; font-size: 13px; font-weight: 600;">${order.paymentMethod === 'cod' ? 'COD' : 'Chuyển khoản'}</span></td>
                <td style="padding: 15px; color: #666;">${formatCurrency(order.total)}</td>
                <td style="padding: 15px;"><span style="background: ${statusInfo.bgColor}; color: #fff; padding: 4px 10px; border-radius: 4px; font-size: 13px; font-weight: 600;">${statusInfo.text}</span></td>
            </tr>
        `;
    }).join('');

    container.innerHTML = html;
}

function logout() {
    window.SAFEALL_API.logout();
    window.location.href = 'login.html';
}
