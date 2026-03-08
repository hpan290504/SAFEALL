document.addEventListener('DOMContentLoaded', async () => {
    // Sync session with server source of truth
    const activeSession = await window.SAFEALL_API.initSession();

    // Auth Guard
    if (!activeSession || activeSession.role !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    loadOrders();
});

function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
}

function formatDate(isoString) {
    const d = new Date(isoString);
    return `${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
}

let currentOrders = [];

async function loadOrders() {
    const tbody = document.getElementById('ordersList');
    const emptyMsg = document.getElementById('emptyOrdersMsg');
    const table = document.getElementById('ordersTable');
    const totalCount = document.getElementById('totalOrderCount');

    // Loading state
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 20px;">Đang tải dữ liệu từ máy chủ...</td></tr>';

    const result = await window.SAFEALL_API.getMyOrders();

    if (!result.success) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: red;">Lỗi: ${result.message}</td></tr>`;
        return;
    }

    currentOrders = result.orders;
    totalCount.innerText = currentOrders.length;

    if (currentOrders.length === 0) {
        table.style.display = 'none';
        emptyMsg.style.display = 'block';
        return;
    }

    table.style.display = 'table';
    emptyMsg.style.display = 'none';
    tbody.innerHTML = '';

    currentOrders.forEach((order, index) => {
        const tr = document.createElement('tr');

        // Status Badge Logic
        let statusBadge = '';
        if (order.status === 'pending') statusBadge = '<span class="badge badge-warning">Chờ xử lý</span>';
        else if (order.status === 'shipping' || order.status === 'delivering') statusBadge = '<span class="badge badge-info">Đang giao</span>';
        else if (order.status === 'completed') statusBadge = '<span class="badge badge-success">Đã hoàn thành</span>';
        else statusBadge = `<span class="badge badge-secondary">${order.status}</span>`;

        let paymentBadge = '';
        if (order.paymentMethod === 'cod') paymentBadge = '<span class="badge badge-secondary">COD</span>';
        else if (order.paymentMethod === 'bank') paymentBadge = '<span class="badge badge-primary">Chuyển khoản</span>';
        else paymentBadge = '<span class="badge badge-dark">Thẻ</span>';

        // Brief items summary
        const itemsSummary = order.items.map(i => `${i.title} (x${i.qty})`).join(', ');

        tr.innerHTML = `
            <td><strong>#${order.id.toUpperCase()}</strong></td>
            <td>${formatDate(order.date)}</td>
            <td>${order.customer.name}</td>
            <td>${order.customer.phone}</td>
            <td class="text-truncate" style="max-width: 200px;" title="${itemsSummary}">${itemsSummary}</td>
            <td class="text-primary-red font-bold">${formatCurrency(order.total)}</td>
            <td>${paymentBadge}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="viewOrder(${index})">Chi tiết</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.viewOrder = function (index) {
    const order = currentOrders[index];
    if (!order) return;

    document.getElementById('detailOrderId').innerText = '#' + order.id.toUpperCase();
    document.getElementById('detailCustomerName').innerText = order.customer.name;
    document.getElementById('detailCustomerPhone').innerText = order.customer.phone;
    document.getElementById('detailCustomerAddress').innerText = order.customer.address;
    document.getElementById('detailOrderNote').innerText = order.note || "Không có lời nhắn.";

    const pList = document.getElementById('detailProductsList');
    pList.innerHTML = '';
    order.items.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.title}</td>
            <td>${item.qty}</td>
            <td class="text-right">${formatCurrency(item.price)}</td>
            <td class="text-right text-primary-red">${formatCurrency(item.total)}</td>
        `;
        pList.appendChild(tr);
    });

    document.getElementById('detailSubtotal').innerText = formatCurrency(order.subtotal);
    document.getElementById('detailShipping').innerText = formatCurrency(order.shippingFee);
    document.getElementById('detailTotal').innerText = formatCurrency(order.total);

    document.getElementById('orderDetailModal').style.display = 'flex';
}

window.closeModal = function () {
    document.getElementById('orderDetailModal').style.display = 'none';
}

window.logout = function () {
    window.SAFEALL_API.logout();
    window.location.href = 'login.html';
}
