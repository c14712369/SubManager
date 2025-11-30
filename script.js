// 1. 初始化資料
let subscriptions = JSON.parse(localStorage.getItem('subscriptions')) || [];
let myChart = null;
let editingId = null; // 用來追蹤正在編輯的項目 ID

// 2. DOM 元素
const form = document.getElementById('sub-form');
const listContainer = document.getElementById('subs-list');
const monthlyTotalEl = document.getElementById('monthly-total');
const yearlyTotalEl = document.getElementById('yearly-total');
const nameSelect = document.getElementById('name-select');
const nameCustom = document.getElementById('name-custom');
const submitBtn = form.querySelector('button[type="submit"]');

// 3. 事件監聽
form.addEventListener('submit', handleFormSubmit);
nameSelect.addEventListener('change', toggleCustomNameInput);

// 4. 功能：切換自訂名稱輸入框的顯示
function toggleCustomNameInput() {
    if (nameSelect.value === 'custom') {
        nameCustom.style.display = 'block';
        nameCustom.required = true;
    } else {
        nameCustom.style.display = 'none';
        nameCustom.required = false;
    }
}

// 5. 核心功能：處理表單提交 (新增或編輯)
function handleFormSubmit(e) {
    e.preventDefault();

    let name = nameSelect.value;
    if (name === 'custom') {
        name = nameCustom.value;
    }

    const price = parseFloat(document.getElementById('price').value);
    const cycle = document.getElementById('cycle').value;
    const nextDate = document.getElementById('nextDate').value;

    if (!name || !price || !cycle || !nextDate) {
        alert('請填寫所有欄位');
        return;
    }

    if (editingId) {
        // --- 編輯模式 ---
        const index = subscriptions.findIndex(sub => sub.id === editingId);
        if (index > -1) {
            subscriptions[index] = { ...subscriptions[index], name, price, cycle, nextDate };
        }
        editingId = null; // 結束編輯模式
        submitBtn.textContent = '新增'; // 恢復按鈕文字
    } else {
        // --- 新增模式 ---
        const subscription = {
            id: Date.now(),
            name,
            price,
            cycle,
            nextDate
        };
        subscriptions.push(subscription);
    }

    saveAndRender();
    form.reset();
    toggleCustomNameInput();
    document.getElementById('nextDate').valueAsDate = new Date();
}

// 6. 核心功能：開始編輯
function startEdit(id) {
    const sub = subscriptions.find(sub => sub.id === id);
    if (!sub) return;

    // 檢查服務名稱是否在預設選項中
    const isCustom = !Array.from(nameSelect.options).some(opt => opt.value === sub.name);

    if (isCustom) {
        nameSelect.value = 'custom';
        nameCustom.value = sub.name;
    } else {
        nameSelect.value = sub.name;
        nameCustom.value = '';
    }
    toggleCustomNameInput();

    document.getElementById('price').value = sub.price;
    document.getElementById('cycle').value = sub.cycle;
    document.getElementById('nextDate').value = sub.nextDate;

    editingId = id; // 進入編輯模式
    submitBtn.textContent = '儲存變更';
    
    // 將頁面滾動到表單位置，方便編輯
    form.scrollIntoView({ behavior: 'smooth' });
}


// 7. 核心功能：刪除訂閱
function deleteSubscription(id) {
    // 如果正在編輯的項目被刪除，取消編輯模式
    if (editingId === id) {
        editingId = null;
        submitBtn.textContent = '新增';
        form.reset();
        toggleCustomNameInput();
    }
    subscriptions = subscriptions.filter(sub => sub.id !== id);
    saveAndRender();
}

// 8. 核心功能：計算倒數天數
function getDaysRemaining(dateString) {
    const targetDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = targetDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

// 9. 渲染 UI
function renderList() {
    listContainer.innerHTML = '';
    
    subscriptions.sort((a, b) => new Date(a.nextDate) - new Date(b.nextDate));

    subscriptions.forEach(sub => {
        const daysLeft = getDaysRemaining(sub.nextDate);
        const isUrgent = daysLeft <= 3 && daysLeft >= 0;
        const isOverdue = daysLeft < 0;

        let daysText = '';
        if (sub.cycle === 'one-time') {
            daysText = `付款日: ${sub.nextDate}`;
        } else if (isOverdue) {
            daysText = `已過期 ${Math.abs(daysLeft)} 天`;
        } else if (daysLeft === 0) {
            daysText = `就是今天！`;
        } else {
            daysText = `還有 ${daysLeft} 天`;
        }

        const cycleTextMap = {
            'monthly': '月繳',
            'quarterly': '季繳',
            'yearly': '年繳',
            'half-yearly': '半年繳',
            'one-time': '單次付款'
        };
        
        const borderColorMap = {
            'monthly': '#8e44ad',
            'quarterly': '#3498db',
            'yearly': '#27ae60',
            'half-yearly': '#2980b9',
            'one-time': '#f39c12'
        };

        const card = document.createElement('div');
        card.className = 'sub-card';
        card.style.borderLeftColor = borderColorMap[sub.cycle] || '#7f8c8d';
        card.innerHTML = `
        <div class="sub-header">
            <div>
                <div class="sub-name">${sub.name}</div>
                <span class="sub-cycle">${cycleTextMap[sub.cycle] || sub.cycle}</span>
            </div>
            <div class="sub-price">${sub.price}</div>
        </div>
        <div class="sub-details">
            <div class="countdown ${isUrgent || isOverdue ? 'urgent' : ''}">
                ${daysText}
            </div>
            <div class="card-actions">
                <button class="edit-btn" onclick="startEdit(${sub.id})">編輯</button>
                <button class="delete-btn" onclick="deleteSubscription(${sub.id})">移除</button>
            </div>
        </div>
    `;
        listContainer.appendChild(card);
    });
}

// 10. 渲染統計數據與圖表
function renderStats() {
    let totalMonthly = 0;
    let totalYearly = 0;

    const labels = [];
    const dataPoints = [];

    const recurringSubs = subscriptions.filter(sub => sub.cycle !== 'one-time');

    recurringSubs.forEach(sub => {
        let monthlyCost = 0;
        if (sub.cycle === 'monthly') {
            monthlyCost = sub.price;
            totalYearly += sub.price * 12;
        } else if (sub.cycle === 'quarterly') {
            monthlyCost = sub.price / 3;
            totalYearly += sub.price * 4;
        } else if (sub.cycle === 'yearly') {
            monthlyCost = sub.price / 12;
            totalYearly += sub.price;
        } else if (sub.cycle === 'half-yearly') {
            monthlyCost = sub.price / 6;
            totalYearly += sub.price * 2;
        }
        
        totalMonthly += monthlyCost;

        labels.push(sub.name);
        dataPoints.push(monthlyCost);
    });

    monthlyTotalEl.innerHTML = `${Math.round(totalMonthly).toLocaleString()} <span>TWD</span>`;
    yearlyTotalEl.innerHTML = `${Math.round(totalYearly).toLocaleString()} <span>TWD</span>`;

    updateChart(labels, dataPoints);
}

// 11. Chart.js 邏輯
function updateChart(labels, data) {
    const ctx = document.getElementById('expenseChart').getContext('2d');

    if (myChart) {
        myChart.destroy();
    }

    if (data.length === 0) {
        labels = ['無週期性訂閱'];
        data = [1];
    }

    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#7b8fa1', '#cfb997', '#564e58', '#fad0c4', '#a2d5c6', '#8590aa'
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        font: { family: "'Noto Sans JP', sans-serif" },
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                label += Math.round(context.parsed) + ' TWD/月均';
                            }
                            return label;
                        }
                    }
                }
            },
            cutout: '70%',
        }
    });
}

// 12. 整合執行
function saveAndRender() {
    localStorage.setItem('subscriptions', JSON.stringify(subscriptions));
    renderList();
    renderStats();
}

// 頁面載入時執行
document.getElementById('nextDate').valueAsDate = new Date();
toggleCustomNameInput();
saveAndRender();