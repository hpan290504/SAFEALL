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

        // Status Badge Logic (Fulfillment & Payment)
        let fStatusBadge = '';
        if (order.fulfillment_status === 'unfulfilled') fStatusBadge = '<span class="badge badge-warning">Chờ xử lý</span>';
        else if (order.fulfillment_status === 'fulfilled') fStatusBadge = '<span class="badge badge-success">Đã giao</span>';
        else fStatusBadge = `<span class="badge badge-secondary">${order.fulfillment_status}</span>`;

        let pStatusBadge = '';
        if (order.payment_status === 'pending') pStatusBadge = '<span class="badge badge-outline-secondary">Chưa thanh toán</span>';
        else if (order.payment_status === 'paid') pStatusBadge = '<span class="badge badge-success">Đã thanh toán</span>';

        let methodBadge = '';
        if (order.payment_method === 'cod') methodBadge = '<span class="badge badge-secondary">COD</span>';
        else if (order.payment_method === 'bank') methodBadge = '<span class="badge badge-primary">Chuyển khoản</span>';

        const itemsSummary = order.items?.map(i => `${i.title} (x${i.quantity})`).join(', ') || 'Không có sản phẩm';

        tr.innerHTML = `
            <td><strong>#${order.short_id}</strong></td>
            <td>${formatDate(order.created_at)}</td>
            <td>${order.full_name}</td>
            <td>${order.phone}</td>
            <td class="text-truncate" style="max-width: 200px;" title="${itemsSummary}">${itemsSummary}</td>
            <td class="text-primary-red font-bold">${formatCurrency(order.total)}</td>
            <td>${methodBadge} ${pStatusBadge}</td>
            <td>${fStatusBadge}</td>
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

    document.getElementById('detailOrderId').innerText = '#' + order.short_id;
    document.getElementById('detailCustomerName').innerText = order.full_name;
    document.getElementById('detailCustomerPhone').innerText = order.phone;
    document.getElementById('detailCustomerAddress').innerText = order.address_line;
    document.getElementById('detailOrderNote').innerText = order.customer_note || "Không có lời nhắn.";

    const pList = document.getElementById('detailProductsList');
    pList.innerHTML = '';
    order.items?.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.title}</td>
            <td>${item.quantity}</td>
            <td class="text-right">${formatCurrency(item.unit_price)}</td>
            <td class="text-right text-primary-red">${formatCurrency(item.total_price)}</td>
        `;
        pList.appendChild(tr);
    });

    document.getElementById('detailSubtotal').innerText = formatCurrency(order.subtotal);
    document.getElementById('detailShipping').innerText = formatCurrency(order.shipping_fee);
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
