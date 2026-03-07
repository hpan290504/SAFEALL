// my-orders.js - Shopee Style
document.addEventListener('DOMContentLoaded', () => {
    const activeSession = JSON.parse(localStorage.getItem('safeall_active_user'));

    // Auth Guard
    if (!activeSession || activeSession.role !== 'user') {
        window.location.href = 'login.html';
        return;
    }

    // Set greeting & Avatar
    document.getElementById('sidebarUserName').innerText = activeSession.identifier;

    let avatarSrc = 'assets/avt_nam.jpg'; // default
    if (activeSession.gender === 'male') {
        avatarSrc = 'assets/avt_nam.jpg';
    } else if (activeSession.gender === 'female') {
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

function getStatusText(status) {
    switch (status) {
        case 'pending': return 'CHỜ THANH TOÁN';
        case 'shipping': return 'VẬN CHUYỂN';
        case 'delivering': return 'CHỜ GIAO HÀNG';
        case 'completed': return 'HOÀN THÀNH';
        case 'cancelled': return 'ĐÃ HỦY';
        case 'returned': return 'TRẢ HÀNG/HOÀN TIỀN';
        default: return 'CHỜ XÁC NHẬN';
    }
}

function loadMyOrders(userPhone, filterStatus, searchQuery = '') {
    const allOrders = JSON.parse(localStorage.getItem('safeall_orders')) || [];

    // Filter by User
    let myOrders = allOrders.filter(o => o.customer && o.customer.phone === userPhone);

    // Apply Tab Filter (Mock mapping since our db is simple)
    if (filterStatus !== 'all') {
        // Since we only save 'pending' initially, let's map 'pending' to 'Chờ giao hàng' to show something in standard flow, 
        // or just strict match if we update admin panel later.
        myOrders = myOrders.filter(o => o.status === filterStatus ||
            (filterStatus === 'delivering' && o.status === 'pending') // Mock mapping for visual populating
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

    const container = document.getElementById('userOrdersList');
    const emptyMsg = document.getElementById('emptyOrdersMsg');
    const tableEl = document.getElementById('ordersTable');

    if (myOrders.length === 0) {
        tableEl.style.display = 'none';
        emptyMsg.style.display = 'block';
        return;
    }

    emptyMsg.style.display = 'none';
    tableEl.style.display = 'table';

    const session = JSON.parse(localStorage.getItem('safeall_active_user'));
    if (!session) return;
    const userName = session.name || session.identifier;
    const currentPhone = session.identifier;

    // Generate Table Rows
    const html = myOrders.map(order => {
        // Status styling map
        const statusMap = {
            'pending': { text: 'Chờ xử lý', color: 'bg-warning text-dark', bgColor: '#ffc107' },
            'shipping': { text: 'Đang giao', color: 'bg-info text-white', bgColor: '#17a2b8' },
            'delivering': { text: 'Chờ giao hàng', color: 'bg-info text-white', bgColor: '#17a2b8' },
            'completed': { text: 'Hoàn thành', color: 'bg-success text-white', bgColor: '#28a745' },
            'cancelled': { text: 'Đã hủy', color: 'bg-danger text-white', bgColor: '#dc3545' },
            'returned': { text: 'Đã trả hàng', color: 'bg-danger text-white', bgColor: '#dc3545' }
        };

        const statusInfo = statusMap[order.status] || { text: order.status, color: 'bg-secondary text-white', bgColor: '#6c757d' };

        // Use a mock date if none exists
        const dateStr = order.date ? new Date(order.date).toLocaleString('vi-VN') : '7/3/2026 16:34';

        // Summarize items
        const itemsSummary = order.items.map(i => `${i.title} (x${i.qty})`).join(', ');

        return `
            <tr style="border-bottom: 1px solid #efefef;">
                <td style="padding: 15px; font-weight: 600; color: #444;">#${order.id.toUpperCase()}</td>
                <td style="padding: 15px; color: #666;">${dateStr}</td>
                <td style="padding: 15px; color: #666; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${itemsSummary}">${itemsSummary}</td>
                <td style="padding: 15px;"><span style="background: var(--primary-blue, #0055aa); color: #fff; padding: 4px 10px; border-radius: 4px; font-size: 13px; font-weight: 600;">Chuyển khoản</span></td>
                <td style="padding: 15px; color: #666;">${formatCurrency(order.total)}</td>
                <td style="padding: 15px;"><span style="background: ${statusInfo.bgColor}; color: #fff; padding: 4px 10px; border-radius: 4px; font-size: 13px; font-weight: 600;">${statusInfo.text}</span></td>
            </tr>
        `;
    }).join('');

    container.innerHTML = html;
}

function logout() {
    localStorage.removeItem('safeall_active_user');
    window.location.href = 'login.html';
}
