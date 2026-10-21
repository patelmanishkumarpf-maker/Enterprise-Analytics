/**
 * MERIDIAN Professional Enterprise Analytics Dashboard
 * Human-Crafted Business Intelligence Architecture
 * Currency: Indian Rupee (₹ INR)
 * Supported Themes:
 *   - warm-sand (Default: Warm Sand & Forest Teal / Terracotta)
 *   - oxford-navy (Oxford Navy & Cobalt)
 *   - graphite-dark (Matte Graphite Dark)
 *   - swiss-mono (Swiss Monochrome & Coral)
 */

// Global State
let appData = {
    kpis: null,
    charts: null,
    simCart: ['Milk']
};

let chartInstances = {};
let currentTheme = localStorage.getItem('meridian_theme') || 'warm-sand';

// Indian Rupee (₹) Formatter Utility
function formatINR(val, decimals = 2) {
    if (val === null || val === undefined || isNaN(val)) return '₹0.00';
    return '₹' + Number(val).toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function getThemeColors() {
    const style = getComputedStyle(document.documentElement);
    return {
        grid: style.getPropertyValue('--chart-grid').trim() || '#ece7dc',
        tick: style.getPropertyValue('--chart-tick').trim() || '#78716c',
        c1: style.getPropertyValue('--chart-c1').trim() || '#0f766e',
        c2: style.getPropertyValue('--chart-c2').trim() || '#c2410c',
        c3: style.getPropertyValue('--chart-c3').trim() || '#b45309',
        c4: style.getPropertyValue('--chart-c4').trim() || '#4338ca',
        c5: style.getPropertyValue('--chart-c5').trim() || '#15803d',
        area: style.getPropertyValue('--chart-area').trim() || 'rgba(15, 118, 110, 0.08)',
        danger: style.getPropertyValue('--brand-danger').trim() || '#be123c',
        success: style.getPropertyValue('--brand-success').trim() || '#15803d',
        primary: style.getPropertyValue('--brand-primary').trim() || '#0f766e',
        accent: style.getPropertyValue('--brand-accent').trim() || '#c2410c',
        card: style.getPropertyValue('--bg-card').trim() || '#ffffff',
        text: style.getPropertyValue('--text-primary').trim() || '#1c1917',
    };
}

// All 15 Commodities Catalog Metadata
const CATALOG = [
    { name: "Tea", code: "P006", category: "Beverages", price: 119.56, icon: "coffee" },
    { name: "Toothpaste", code: "P014", category: "Personal Care", price: 80.01, icon: "smile" },
    { name: "Eggs", code: "P004", category: "Dairy", price: 69.92, icon: "egg" },
    { name: "Chips", code: "P010", category: "Snacks", price: 35.04, icon: "cookie" },
    { name: "Noodles", code: "P015", category: "Grocery", price: 54.99, icon: "utensils" },
    { name: "Coffee", code: "P007", category: "Beverages", price: 180.29, icon: "cup-soda" },
    { name: "Bread", code: "P001", category: "Grocery", price: 39.96, icon: "sandwich" },
    { name: "Butter", code: "P003", category: "Dairy", price: 55.08, icon: "package" },
    { name: "Shampoo", code: "P013", category: "Personal Care", price: 150.40, icon: "sparkles" },
    { name: "Juice", code: "P011", category: "Beverages", price: 90.11, icon: "glass-water" },
    { name: "Rice", code: "P009", category: "Grocery", price: 64.85, icon: "wheat" },
    { name: "Sugar", code: "P008", category: "Grocery", price: 45.00, icon: "box" },
    { name: "Milk", code: "P002", category: "Dairy", price: 29.97, icon: "milk" },
    { name: "Soap", code: "P012", category: "Personal Care", price: 50.08, icon: "shield" },
    { name: "Biscuits", code: "P005", category: "Snacks", price: 24.95, icon: "circle" }
];

document.addEventListener("DOMContentLoaded", async function() {
    initTheme();
    renderRecommenderCatalog();
    updateSimCartUI();
    initIngestionDefaults();
    await loadDashboardData();
    updateStudioChart();
    loadOlapOp('rollup');
    updateMiningRules();
    loadCooccurrence();
    loadAdvancedAnalytics();
    runCartRecommendation();
    loadDatasetStatus();
});

// -------------------------------------------------------------
// Theme Management (Warm Sand / Oxford Navy / Graphite / Swiss)
// -------------------------------------------------------------
function initTheme() {
    changeTheme(currentTheme, false);
}

function changeTheme(theme, rerenderCharts = true) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('meridian_theme', theme);

    const selector = document.getElementById('themeSelector');
    if (selector && selector.value !== theme) {
        selector.value = theme;
    }

    initChartDefaults();

    if (rerenderCharts) {
        if (appData.charts) renderPresetCharts(appData.charts);
        updateStudioChart();
        loadCooccurrence();
        loadAdvancedAnalytics();
        updateMiningRules();
    }
}

function initChartDefaults() {
    const tc = getThemeColors();
    Chart.defaults.color = tc.tick;
    Chart.defaults.font.family = 'Plus Jakarta Sans, sans-serif';
    Chart.defaults.borderColor = tc.grid;
    Chart.defaults.plugins.tooltip.backgroundColor = currentTheme === 'graphite-dark' ? '#18181c' : '#1c1917';
    Chart.defaults.plugins.tooltip.titleColor = '#ffffff';
    Chart.defaults.plugins.tooltip.bodyColor = '#f4f4f5';
    Chart.defaults.plugins.tooltip.borderColor = tc.grid;
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 8;
    Chart.defaults.plugins.tooltip.cornerRadius = 6;
}

function getFilterParams() {
    const y = document.getElementById('filterYear').value;
    const c = document.getElementById('filterCountry').value;
    const s = document.getElementById('filterStatus').value;
    return `year=${encodeURIComponent(y)}&country=${encodeURIComponent(c)}&status=${encodeURIComponent(s)}`;
}

async function applyGlobalFilters() {
    await loadDashboardData();
    updateStudioChart();
}

function resetGlobalFilters() {
    document.getElementById('filterYear').value = 'all';
    document.getElementById('filterCountry').value = 'all';
    document.getElementById('filterStatus').value = 'all';
    applyGlobalFilters();
}

// Tab Switching Controller
function switchTab(tabId) {
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-tab-btn').forEach(el => el.classList.remove('active'));

    const activePane = document.getElementById(`tab-${tabId}`);
    if (activePane) activePane.classList.remove('hidden');

    const activeBtn = document.querySelector(`.nav-tab-btn[data-tab="${tabId}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    if (tabId === 'ingestion') {
        loadDatasetStatus();
        loadRecentTransactionsTable();
    }

    window.dispatchEvent(new Event('resize'));
    lucide.createIcons();
}

// -------------------------------------------------------------
// 1. Data Fetching & KPI Ribbon
// -------------------------------------------------------------
async function loadDashboardData() {
    const filterQuery = getFilterParams();

    try {
        const kpiRes = await fetch(`/api/kpis?${filterQuery}`);
        appData.kpis = await kpiRes.json();

        // Update Full-Width KPI Ribbon in ₹ INR
        document.getElementById('kpiRecords').textContent = appData.kpis.total_records.toLocaleString('en-IN');
        document.getElementById('kpiCompletedSales').textContent = formatINR(appData.kpis.net_sales);
        document.getElementById('kpiCompletedCount').textContent = `${appData.kpis.completed_orders.toLocaleString('en-IN')} fulfilled`;
        document.getElementById('kpiGrossSales').textContent = formatINR(appData.kpis.gross_sales);
        document.getElementById('kpiCancelRate').textContent = `${appData.kpis.cancellation_rate}% cancelled`;
        document.getElementById('kpiBaskets').textContent = appData.kpis.analyzed_baskets.toLocaleString('en-IN');
        document.getElementById('kpiRules').textContent = appData.kpis.association_rules.toLocaleString('en-IN');
        document.getElementById('kpiProducts').textContent = appData.kpis.unique_products.toLocaleString('en-IN');

        // Fetch & Render Base Charts
        const chartRes = await fetch(`/api/charts?${filterQuery}`);
        appData.charts = await chartRes.json();

        renderPresetCharts(appData.charts);

    } catch (e) {
        console.error("Dashboard data load error:", e);
    }
}

function renderPresetCharts(data) {
    const tc = getThemeColors();

    // 1. Monthly Revenue Area Chart
    const ctxMonthly = document.getElementById('chartMonthlyRevenue').getContext('2d');
    if (chartInstances.monthly) chartInstances.monthly.destroy();

    chartInstances.monthly = new Chart(ctxMonthly, {
        type: 'line',
        data: {
            labels: data.monthly_trend.labels,
            datasets: [
                {
                    label: 'Fulfilled Orders (₹)',
                    data: data.monthly_trend.completed,
                    borderColor: tc.success,
                    backgroundColor: tc.area,
                    fill: true,
                    tension: 0.35,
                    borderWidth: 2,
                    pointRadius: 2
                },
                {
                    label: 'Cancelled Orders (₹)',
                    data: data.monthly_trend.cancelled,
                    borderColor: tc.danger,
                    backgroundColor: 'rgba(190, 18, 60, 0.04)',
                    fill: true,
                    tension: 0.35,
                    borderWidth: 1.5,
                    borderDash: [4, 4],
                    pointRadius: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false }, ticks: { maxTicksLimit: 12, color: tc.tick } },
                y: {
                    grid: { color: tc.grid },
                    ticks: {
                        color: tc.tick,
                        callback: v => `₹${(v/1000).toFixed(0)}k`
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${formatINR(ctx.parsed.y)}`
                    }
                }
            }
        }
    });

    // 2. Category Share Donut Chart
    const ctxCat = document.getElementById('chartCategoryDonut').getContext('2d');
    if (chartInstances.category) chartInstances.category.destroy();

    const catColors = [tc.c1, tc.c2, tc.c3, tc.c4, tc.c5];
    chartInstances.category = new Chart(ctxCat, {
        type: 'doughnut',
        data: {
            labels: data.category_data.labels,
            datasets: [{
                data: data.category_data.revenue,
                backgroundColor: catColors,
                borderWidth: 2,
                borderColor: tc.card,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.label}: ${formatINR(ctx.parsed)}`
                    }
                }
            }
        }
    });

    // Category Legend Badges
    const leg = document.getElementById('categoryLegend');
    const totalRev = data.category_data.revenue.reduce((a, b) => a + b, 0);
    leg.innerHTML = data.category_data.labels.map((l, i) => {
        const rev = data.category_data.revenue[i];
        const pct = totalRev > 0 ? ((rev / totalRev) * 100).toFixed(1) : 0;
        return `
            <div class="flex items-center justify-between p-2 rounded-md border" style="background-color: var(--bg-card); border-color: var(--border-color);">
                <div class="flex items-center space-x-2 truncate">
                    <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${catColors[i % catColors.length]}"></span>
                    <span class="truncate font-semibold text-[11px]" style="color: var(--text-primary);">${l}</span>
                </div>
                <div class="text-right">
                    <span class="font-bold block text-xs" style="color: var(--brand-primary);">${pct}%</span>
                    <span class="text-[10px] font-mono" style="color: var(--text-muted);">${formatINR(rev, 0)}</span>
                </div>
            </div>
        `;
    }).join('');

    // 3. Basket Size Histogram
    const ctxSize = document.getElementById('chartBasketSizeDist').getContext('2d');
    if (chartInstances.basketSize) chartInstances.basketSize.destroy();

    chartInstances.basketSize = new Chart(ctxSize, {
        type: 'bar',
        data: {
            labels: data.basket_size_distribution.labels,
            datasets: [{
                label: 'Orders Count',
                data: data.basket_size_distribution.counts,
                backgroundColor: tc.c3,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false }, ticks: { color: tc.tick } },
                y: { grid: { color: tc.grid }, ticks: { color: tc.tick } }
            },
            plugins: { legend: { display: false } }
        }
    });

    // 4. Order Spend Bins Histogram (₹ Bins)
    const ctxSpend = document.getElementById('chartOrderSpendDist').getContext('2d');
    if (chartInstances.orderSpend) chartInstances.orderSpend.destroy();

    chartInstances.orderSpend = new Chart(ctxSpend, {
        type: 'bar',
        data: {
            labels: data.order_spend_distribution.labels,
            datasets: [{
                label: 'Frequency',
                data: data.order_spend_distribution.counts,
                backgroundColor: tc.c1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false }, ticks: { color: tc.tick } },
                y: { grid: { color: tc.grid }, ticks: { color: tc.tick } }
            },
            plugins: { legend: { display: false } }
        }
    });
}


// -------------------------------------------------------------
// 2. DYNAMIC USER-CHOOSEABLE GRAPH STUDIO
// -------------------------------------------------------------
async function updateStudioChart() {
    const dim = document.getElementById('studioDimension').value;
    const met = document.getElementById('studioMetric').value;
    const agg = document.getElementById('studioAgg').value;
    const type = document.getElementById('studioType').value;
    const sort = document.getElementById('studioSort').value;
    const filters = getFilterParams();

    try {
        const url = `/api/custom_chart?dimension=${dim}&metric=${met}&agg=${agg}&type=${type}&sort=${sort}&${filters}`;
        const res = await fetch(url);
        const json = await res.json();

        const isCurrency = (met === 'TotalAmount' || met === 'UnitPrice');

        // Update Titles & Point Count
        const metricDisplay = isCurrency ? `${json.metric_label} (₹)` : json.metric_label;
        document.getElementById('studioChartTitle').textContent = `${metricDisplay} grouped by ${json.dimension}`;
        document.getElementById('studioPointCount').textContent = `${json.labels.length} Segments`;

        // Update Intelligence Stats in ₹ if currency
        const formatStat = val => {
            if (isCurrency) return formatINR(val);
            if (met === 'Discount') return `${Number(val).toFixed(1)}%`;
            return Number(val).toLocaleString('en-IN');
        };

        document.getElementById('statStudioTotal').textContent = formatStat(json.stats.total);
        document.getElementById('statStudioAvg').textContent = formatStat(json.stats.average);
        document.getElementById('statStudioLeader').textContent = json.stats.peak_label;
        document.getElementById('statStudioPeakVal').textContent = formatStat(json.stats.peak_value);

        // Render Canvas with Selected Chart Type
        const ctx = document.getElementById('chartStudioCanvas').getContext('2d');
        if (chartInstances.studio) chartInstances.studio.destroy();

        const tc = getThemeColors();
        const palette = [
            tc.c1, tc.c2, tc.c3, tc.c4, tc.c5,
            tc.danger, '#64748b', '#0891b2', '#ca8a04', '#4338ca'
        ];

        let bgColors;
        if (type === 'bar' || type === 'doughnut' || type === 'polarArea') {
            bgColors = json.labels.map((_, i) => palette[i % palette.length]);
        } else {
            bgColors = tc.area;
        }

        chartInstances.studio = new Chart(ctx, {
            type: type,
            data: {
                labels: json.labels,
                datasets: [{
                    label: metricDisplay,
                    data: json.values,
                    backgroundColor: bgColors,
                    borderColor: type === 'line' ? tc.primary : tc.card,
                    borderWidth: type === 'line' ? 2 : 1,
                    fill: type === 'line',
                    tension: 0.3,
                    borderRadius: type === 'bar' ? 4 : 0,
                    pointRadius: type === 'line' ? 3 : 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: (type === 'doughnut' || type === 'polarArea' || type === 'radar') ? {} : {
                    x: { grid: { display: false }, ticks: { maxTicksLimit: 15, color: tc.tick } },
                    y: {
                        grid: { color: tc.grid },
                        ticks: {
                            color: tc.tick,
                            callback: function(v) {
                                if (isCurrency) {
                                    return v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`;
                                }
                                return v;
                            }
                        }
                    }
                },
                plugins: {
                    legend: { display: (type === 'doughnut' || type === 'polarArea'), position: 'bottom', labels: { boxWidth: 10, color: tc.tick } },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const val = context.parsed.y !== undefined ? context.parsed.y : context.parsed;
                                return ` ${metricDisplay}: ${formatStat(val)}`;
                            }
                        }
                    }
                }
            }
        });

    } catch (e) {
        console.error("Studio Chart Error:", e);
    }
}

function setStudioPreset(preset) {
    if (preset === 'dept_sales') {
        document.getElementById('studioDimension').value = 'ProductCategory';
        document.getElementById('studioMetric').value = 'TotalAmount';
        document.getElementById('studioAgg').value = 'sum';
        document.getElementById('studioType').value = 'bar';
    } else if (preset === 'country_vol') {
        document.getElementById('studioDimension').value = 'Country';
        document.getElementById('studioMetric').value = 'Quantity';
        document.getElementById('studioAgg').value = 'sum';
        document.getElementById('studioType').value = 'doughnut';
    } else if (preset === 'monthly_traj') {
        document.getElementById('studioDimension').value = 'YearMonth';
        document.getElementById('studioMetric').value = 'TotalAmount';
        document.getElementById('studioAgg').value = 'sum';
        document.getElementById('studioType').value = 'line';
    } else if (preset === 'payment_aov') {
        document.getElementById('studioDimension').value = 'PaymentMethod';
        document.getElementById('studioMetric').value = 'TotalAmount';
        document.getElementById('studioAgg').value = 'mean';
        document.getElementById('studioType').value = 'bar';
    }
    updateStudioChart();
}


// -------------------------------------------------------------
// 3. Data Warehouse OLAP Operations (The 5 exact queries)
// -------------------------------------------------------------
async function loadOlapOp(op) {
    document.querySelectorAll('.olap-btn').forEach(b => {
        b.classList.remove('active');
    });

    const activeBtn = document.getElementById(`btnOp${op.charAt(0).toUpperCase() + op.slice(1)}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }

    try {
        const res = await fetch(`/api/olap?operation=${op}`);
        const json = await res.json();

        document.getElementById('olapCodeSnippet').textContent = json.code_snippet;
        document.getElementById('olapDescription').textContent = json.description;

        const thead = document.getElementById('olapThead');
        const tbody = document.getElementById('olapTbody');

        // Headers
        thead.innerHTML = '<tr class="border-b" style="border-color: var(--border-color);">' +
            json.columns.map(c => `<th class="py-2.5 px-3">${c}</th>`).join('') +
            '</tr>';

        // Rows with ₹ formatting
        tbody.innerHTML = json.rows.map(row => {
            return `<tr>` +
                json.columns.map(c => {
                    const val = row[c];
                    let formatted = val;
                    if (typeof val === 'number') {
                        if (c === 'TotalAmount' || c === 'UnitPrice' || c === 'Completed' || c === 'Cancelled') {
                            formatted = formatINR(val);
                        } else if (val % 1 === 0) {
                            formatted = val.toLocaleString('en-IN');
                        } else {
                            formatted = formatINR(val);
                        }
                    }
                    return `<td class="py-2 px-3 font-mono text-xs">${formatted}</td>`;
                }).join('') +
                `</tr>`;
        }).join('');

    } catch (e) {
        console.error("OLAP Error:", e);
    }
}


// -------------------------------------------------------------
// 4. Apriori Mining & Scatter Chart & 15x15 Heatmap
// -------------------------------------------------------------
async function updateMiningRules() {
    const minSup = document.getElementById('sliderMinSupport').value;
    const minConf = document.getElementById('sliderMinConfidence').value;
    const minLift = document.getElementById('sliderMinLift').value;
    const search = document.getElementById('ruleSearchInput').value;

    document.getElementById('lblMinSupport').textContent = parseFloat(minSup).toFixed(3);
    document.getElementById('lblMinConfidence').textContent = parseFloat(minConf).toFixed(2);
    document.getElementById('lblMinLift').textContent = parseFloat(minLift).toFixed(2);

    try {
        const url = `/api/rules?min_support=${minSup}&min_confidence=${minConf}&min_lift=${minLift}&search=${encodeURIComponent(search)}&limit=15`;
        const res = await fetch(url);
        const json = await res.json();

        document.getElementById('rulesCountBadge').textContent = `${json.matching_rules} of ${json.total_rules} Rules`;

        // Render Table
        const tbody = document.getElementById('rulesTableBody');
        tbody.innerHTML = json.rules.map(r => {
            return `
                <tr>
                    <td class="py-2.5 px-3 font-bold" style="color: var(--text-faint);">${r.index}</td>
                    <td class="py-2.5 px-4 font-bold font-sans" style="color: var(--brand-primary);">(${r.antecedents})</td>
                    <td class="py-2.5 px-4 font-bold font-sans" style="color: var(--brand-success);">&rarr; (${r.consequents})</td>
                    <td class="py-2.5 px-3 text-right" style="color: var(--text-muted);">${r.support.toFixed(6)}</td>
                    <td class="py-2.5 px-3 text-right" style="color: var(--text-muted);">${r.confidence.toFixed(6)}</td>
                    <td class="py-2.5 px-3 text-right font-extrabold font-mono" style="color: var(--brand-accent);">${r.lift.toFixed(6)}</td>
                </tr>
            `;
        }).join('');

        // Render Scatter Plot
        renderScatterPlot(json.scatter);

    } catch (e) {
        console.error("Rules fetch failed:", e);
    }
}

function renderScatterPlot(points) {
    const tc = getThemeColors();

    const ctx = document.getElementById('chartScatterCanvas').getContext('2d');
    if (chartInstances.scatter) chartInstances.scatter.destroy();

    chartInstances.scatter = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Association Rules',
                data: points.map(p => ({ x: p.x, y: p.y, lift: p.lift, rule: p.rule })),
                backgroundColor: points.map(p => p.lift > 1.4 ? tc.danger : (p.lift > 1.25 ? tc.c1 : tc.c2)),
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: { display: true, text: 'Support (Item Frequency)', color: tc.tick },
                    grid: { color: tc.grid },
                    ticks: { color: tc.tick }
                },
                y: {
                    title: { display: true, text: 'Confidence P(Consequent|Antecedent)', color: tc.tick },
                    grid: { color: tc.grid },
                    ticks: { color: tc.tick }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `Rule: ${ctx.raw.rule} | Lift: ${ctx.raw.lift}`
                    }
                }
            }
        }
    });
}

async function loadCooccurrence() {
    try {
        const res = await fetch('/api/cooccurrence');
        const json = await res.json();
        const table = document.getElementById('cooccurrenceTable');

        let html = '<thead><tr style="background-color: var(--bg-card-subtle); color: var(--text-muted);">';
        html += '<th class="py-1.5 px-2 text-left sticky left-0" style="background-color: var(--bg-card-subtle);">Product</th>';
        json.products.forEach(p => {
            html += `<th class="py-1.5 px-1">${p.substring(0, 3)}</th>`;
        });
        html += '</tr></thead><tbody>';

        json.matrix.forEach(row => {
            html += `<tr><td class="py-1 px-2 font-bold text-left sticky left-0 border-r" style="background-color: var(--bg-card); color: var(--text-primary); border-color: var(--border-color);">${row.product}</td>`;
            json.products.forEach(p => {
                const count = row[p];
                const isDiag = row.product === p;
                let bgStyle = "";
                if (isDiag) {
                    bgStyle = "background-color: var(--brand-primary-light); color: var(--brand-primary); font-weight: bold;";
                } else if (count > 75) {
                    bgStyle = "background-color: var(--brand-danger-light); color: var(--brand-danger); font-weight: 600;";
                } else if (count > 65) {
                    bgStyle = "background-color: var(--brand-accent-light); color: var(--brand-accent);";
                } else {
                    bgStyle = "color: var(--text-muted);";
                }
                html += `<td class="matrix-cell" style="${bgStyle}" title="${row.product} & ${p}: ${count}">${count}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody>';
        table.innerHTML = html;
    } catch (e) {
        console.error("Cooccurrence matrix load failed:", e);
    }
}


// -------------------------------------------------------------
// 5. Intelligent Recommender & Basket Simulator
// -------------------------------------------------------------
function renderRecommenderCatalog() {
    const grid = document.getElementById('recommenderProductGrid');
    grid.innerHTML = CATALOG.map(prod => {
        return `
            <div class="prod-catalog-card flex flex-col justify-between cursor-pointer" id="prodCard-${prod.name}" onclick="toggleSimCart('${prod.name}')">
                <div>
                    <div class="flex items-center justify-between mb-1.5">
                        <span class="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border" style="background-color: var(--bg-card-subtle); color: var(--text-muted); border-color: var(--border-color);">${prod.code}</span>
                        <span class="text-[9px]" style="color: var(--text-muted);">${prod.category}</span>
                    </div>
                    <span class="font-bold text-xs block" style="color: var(--text-primary);">${prod.name}</span>
                </div>
                <div class="flex items-center justify-between mt-2 pt-1.5 border-t" style="border-color: var(--border-color);">
                    <span class="text-[11px] font-mono font-bold" style="color: var(--brand-success);">${formatINR(prod.price)}</span>
                    <span class="pointer-events-none w-5 h-5 rounded flex items-center justify-center transition border" style="background-color: var(--bg-card-subtle); color: var(--text-secondary); border-color: var(--border-color);">
                        <i data-lucide="plus" class="w-3 h-3"></i>
                    </span>
                </div>
            </div>
        `;
    }).join('');
    lucide.createIcons();
}

function toggleSimCart(name) {
    const idx = appData.simCart.indexOf(name);
    if (idx > -1) {
        appData.simCart.splice(idx, 1);
    } else {
        appData.simCart.push(name);
    }
    updateSimCartUI();
    if (appData.simCart.length === 0) {
        clearSimCart();
    } else {
        runCartRecommendation();
    }
}

function clearSimCart() {
    appData.simCart = [];
    updateSimCartUI();
    document.getElementById('recHeader').textContent = "Recommendations:";
    document.getElementById('recArrayOutput').textContent = "Cart is empty. Select commodities from the catalog to generate recommendations.";
    document.getElementById('recDetailsCards').innerHTML = "";
}

function updateSimCartUI() {
    CATALOG.forEach(p => {
        const card = document.getElementById(`prodCard-${p.name}`);
        if (card) {
            if (appData.simCart.includes(p.name)) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        }
    });

    document.getElementById('cartCountBadge').textContent = `${appData.simCart.length} item${appData.simCart.length === 1 ? '' : 's'}`;

    const list = document.getElementById('cartItemsList');
    if (appData.simCart.length === 0) {
        list.innerHTML = `<p class="text-slate-400 italic text-center py-6">Your cart is empty. Click any product to test recommendations.</p>`;
        return;
    }

    list.innerHTML = appData.simCart.map(item => {
        const prod = CATALOG.find(p => p.name === item) || { price: 50.0 };
        return `
            <div class="flex items-center justify-between p-2 rounded-md border" style="background-color: var(--bg-card-subtle); border-color: var(--border-color);">
                <div class="flex items-center space-x-2">
                    <span class="w-2 h-2 rounded-full" style="background-color: var(--brand-primary);"></span>
                    <span class="font-bold text-xs" style="color: var(--text-primary);">${item}</span>
                </div>
                <div class="flex items-center space-x-3">
                    <span class="font-mono font-bold" style="color: var(--brand-success);">${formatINR(prod.price)}</span>
                    <button onclick="toggleSimCart('${item}')" class="text-slate-400 hover:text-rose-600 transition" title="Remove from cart">
                        <i data-lucide="x" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    lucide.createIcons();
}

async function runCartRecommendation(isManualClick = false) {
    const btn = document.getElementById('btnGenerateRecs');
    const btnText = document.getElementById('btnGenerateRecsText');
    const btnIcon = document.getElementById('btnGenerateRecsIcon');
    const recHeader = document.getElementById('recHeader');
    const recArrayOutput = document.getElementById('recArrayOutput');
    const recCards = document.getElementById('recDetailsCards');

    if (appData.simCart.length === 0) {
        recHeader.textContent = "Recommendations:";
        recArrayOutput.textContent = "Please select at least one commodity from the catalog to generate recommendations.";
        recCards.innerHTML = "";
        if (isManualClick && btn) {
            btn.classList.add('ring-2', 'ring-rose-500');
            setTimeout(() => btn.classList.remove('ring-2', 'ring-rose-500'), 1000);
        }
        return;
    }

    if (btnText) {
        btnText.textContent = "Analyzing Basket...";
        if (btnIcon) btnIcon.classList.add('animate-spin');
    }

    try {
        const res = await fetch('/api/recommend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ products: appData.simCart, top_n: 5 })
        });
        const json = await res.json();

        // Exact Array String Output
        recHeader.textContent = `Recommendations for [${json.input_product}]:`;
        if (json.recommendations && json.recommendations.length > 0) {
            recArrayOutput.textContent = JSON.stringify(json.recommendations).replace(/"/g, "'");
        } else {
            recArrayOutput.textContent = "No further unselected commodities found matching association criteria for this basket.";
        }

        // Detail Attachment Cards with "Add to Cart" button for direct cross-sell exploration
        if (json.details && json.details.length > 0) {
            recCards.innerHTML = json.details.map((d, i) => {
                return `
                    <div class="p-2.5 rounded-lg border flex items-center justify-between transition hover:shadow-sm" style="background-color: var(--bg-card); border-color: var(--border-color);">
                        <div class="flex items-center space-x-2.5">
                            <span class="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] font-mono border" style="background-color: var(--brand-primary-light); color: var(--brand-primary); border-color: var(--brand-primary-border);">#${i + 1}</span>
                            <div>
                                <div class="flex items-center space-x-2">
                                    <span class="font-bold block text-xs" style="color: var(--text-primary);">${d.product}</span>
                                    <button onclick="toggleSimCart('${d.product}')" class="text-[10px] px-2 py-0.5 rounded border font-semibold flex items-center space-x-1 transition hover:opacity-80 active:scale-95" style="background-color: var(--brand-success-light); color: var(--brand-success); border-color: var(--brand-success-border);" title="Add ${d.product} to simulated basket">
                                        <i data-lucide="plus" class="w-2.5 h-2.5"></i>
                                        <span>Add to Cart</span>
                                    </button>
                                </div>
                                <span class="text-[10px] font-mono block mt-0.5" style="color: var(--text-muted);">When in basket: (${d.antecedent})</span>
                            </div>
                        </div>
                        <div class="text-right font-mono">
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold border" style="background-color: var(--brand-primary-light); color: var(--brand-primary); border-color: var(--brand-primary-border);">Lift: ${d.lift}</span>
                            <span class="text-[10px] block mt-0.5" style="color: var(--text-muted);">Conf: ${(d.confidence * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            recCards.innerHTML = `<p class="text-xs text-slate-400 italic text-center py-3">All top associated commodities for this basket are already in your cart.</p>`;
        }
        lucide.createIcons();

    } catch (e) {
        console.error("Recommendation failure:", e);
        recArrayOutput.textContent = "Failed to fetch recommendations. Please verify the server connection.";
    } finally {
        if (btnText) {
            btnText.textContent = "Generate Recommendations";
            if (btnIcon) btnIcon.classList.remove('animate-spin');
        }
    }
}


// -------------------------------------------------------------
// 6. Advanced Analytics: Classification & Clustering
// -------------------------------------------------------------
async function loadAdvancedAnalytics() {
    const tc = getThemeColors();

    try {
        // Classification Feature Importance
        const clsRes = await fetch('/api/classification');
        const clsData = await clsRes.json();

        const ctxFeat = document.getElementById('chartFeatureImp').getContext('2d');
        if (chartInstances.featureImp) chartInstances.featureImp.destroy();

        chartInstances.featureImp = new Chart(ctxFeat, {
            type: 'bar',
            data: {
                labels: clsData.feature_importances.map(f => f.feature),
                datasets: [{
                    label: 'Gini Importance',
                    data: clsData.feature_importances.map(f => f.importance),
                    backgroundColor: tc.danger,
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { grid: { color: tc.grid }, ticks: { color: tc.tick } },
                    y: { grid: { display: false }, ticks: { color: tc.tick } }
                },
                plugins: { legend: { display: false } }
            }
        });

        // Clustering PCA 2D Scatter
        const clusterRes = await fetch('/api/clustering');
        const clusterData = await clusterRes.json();

        const ctxPca = document.getElementById('chartPcaCanvas').getContext('2d');
        if (chartInstances.pca) chartInstances.pca.destroy();

        const clusterPalette = [tc.c1, tc.c2, tc.c3, tc.c4];

        chartInstances.pca = new Chart(ctxPca, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Transaction Clusters',
                    data: clusterData.pca_sample.map(p => ({ x: p.x, y: p.y, cluster: p.cluster, invoice: p.invoice })),
                    backgroundColor: clusterData.pca_sample.map(p => clusterPalette[p.cluster % clusterPalette.length]),
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: 'PCA Component 1', color: tc.tick }, grid: { color: tc.grid }, ticks: { color: tc.tick } },
                    y: { title: { display: true, text: 'PCA Component 2', color: tc.tick }, grid: { color: tc.grid }, ticks: { color: tc.tick } }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => `Invoice: ${ctx.raw.invoice} | Cohort ${ctx.raw.cluster + 1}`
                        }
                    }
                }
            }
        });

    } catch (e) {
        console.error("Advanced analytics load error:", e);
    }
}


// -------------------------------------------------------------
// 7. Data Ingestion & Live Transaction Pipeline
// -------------------------------------------------------------

const COMMODITY_CATALOG = {
    "Milk": { category: "Dairy", code: "P002", price: 29.97 },
    "Bread": { category: "Bakery", code: "P001", price: 28.50 },
    "Butter": { category: "Dairy", code: "P003", price: 55.08 },
    "Eggs": { category: "Dairy", code: "P004", price: 69.20 },
    "Biscuits": { category: "Snacks", code: "P005", price: 24.95 },
    "Tea": { category: "Beverages", code: "P006", price: 128.68 },
    "Coffee": { category: "Beverages", code: "P007", price: 210.50 },
    "Sugar": { category: "Grocery", code: "P008", price: 45.00 },
    "Rice": { category: "Grocery", code: "P009", price: 64.85 },
    "Chips": { category: "Snacks", code: "P010", price: 32.03 },
    "Juice": { category: "Beverages", code: "P011", price: 90.11 },
    "Soap": { category: "Personal Care", code: "P012", price: 50.08 },
    "Shampoo": { category: "Personal Care", code: "P013", price: 150.40 },
    "Toothpaste": { category: "Personal Care", code: "P014", price: 81.87 },
    "Noodles": { category: "Grocery", code: "P015", price: 42.00 }
};

function initIngestionDefaults() {
    const dateInput = document.getElementById('txInvoiceDate');
    if (dateInput && !dateInput.value) {
        dateInput.value = '2022-12-31';
    }
    handleProductSelectChange();
    calculateFormTotal();
}

function handleProductSelectChange() {
    const sel = document.getElementById('txProduct');
    if (!sel) return;
    const prodName = sel.value;
    const info = COMMODITY_CATALOG[prodName] || { category: "Retail", code: "P999", price: 30.0 };

    const catBadge = document.getElementById('txBadgeCategory');
    const codeBadge = document.getElementById('txBadgeStockCode');
    const priceInput = document.getElementById('txUnitPrice');

    if (catBadge) catBadge.textContent = info.category;
    if (codeBadge) codeBadge.textContent = info.code;
    if (priceInput) priceInput.value = info.price.toFixed(2);

    calculateFormTotal();
}

function calculateFormTotal() {
    const qty = parseFloat(document.getElementById('txQuantity')?.value) || 1;
    const price = parseFloat(document.getElementById('txUnitPrice')?.value) || 0;
    const disc = parseFloat(document.getElementById('txDiscount')?.value) || 0;

    const total = qty * price * (1.0 - (disc / 100.0));
    const totalEl = document.getElementById('txComputedTotal');
    if (totalEl) {
        totalEl.textContent = formatINR(total);
    }
}

async function autoSuggestInvoiceNo() {
    try {
        const res = await fetch('/api/dataset/status');
        const data = await res.json();
        const recent = data.recent_transactions || [];
        let maxInv = 12000;
        if (recent.length > 0) {
            maxInv = Math.max(...recent.map(r => parseInt(r.InvoiceNo) || 0));
        }
        const invInput = document.getElementById('txInvoiceNo');
        if (invInput) invInput.value = maxInv + 1;
    } catch (e) {
        const invInput = document.getElementById('txInvoiceNo');
        if (invInput) invInput.value = 12001;
    }
}

async function loadDatasetStatus() {
    try {
        const res = await fetch('/api/dataset/status');
        const data = await res.json();
        const meta = data.metadata || {};

        const nameEl = document.getElementById('dsStatusName');
        const rowsEl = document.getElementById('dsStatusRows');
        const rulesEl = document.getElementById('dsStatusRules');
        const timeEl = document.getElementById('dsStatusTime');

        if (nameEl) nameEl.textContent = meta.source_name || "Operational DW";
        if (rowsEl) rowsEl.textContent = Number(meta.total_rows || 0).toLocaleString();
        if (rulesEl) rulesEl.textContent = `${Number(meta.total_rules || 0).toLocaleString()} Rules`;
        if (timeEl) timeEl.textContent = meta.last_updated || "Live Operational";

        renderRecentTransactions(data.recent_transactions || []);
    } catch (e) {
        console.error("Failed to load dataset status:", e);
    }
}

async function loadRecentTransactionsTable() {
    try {
        const res = await fetch('/api/transactions/recent?limit=20');
        const data = await res.json();
        renderRecentTransactions(data.transactions || []);
    } catch (e) {
        console.error("Failed to load recent transactions:", e);
    }
}

function renderRecentTransactions(transactions) {
    const tbody = document.getElementById('recentTransactionsTableBody');
    if (!tbody) return;

    if (!transactions || transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center py-6 text-slate-400 italic">No transactions recorded yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = transactions.map(t => {
        const isCompleted = String(t.OrderStatus).toLowerCase() === 'completed';
        const badgeStyle = isCompleted
            ? 'background-color: var(--brand-success-light); color: var(--brand-success); border-color: var(--brand-success-border);'
            : 'background-color: var(--brand-danger-light); color: var(--brand-danger); border-color: var(--brand-danger-border);';

        return `
            <tr class="hover:bg-amber-500/5 transition">
                <td class="py-2.5 px-3 font-bold" style="color: var(--text-primary);">${t.InvoiceNo}</td>
                <td class="py-2.5 px-3 text-[11px]" style="color: var(--text-muted);">${t.InvoiceDate}</td>
                <td class="py-2.5 px-3 font-semibold" style="color: var(--brand-primary);">${t.Description}</td>
                <td class="py-2.5 px-3 text-[11px]" style="color: var(--text-muted);">${t.ProductCategory || '-'}</td>
                <td class="py-2.5 px-3 text-right font-bold">${t.Quantity}</td>
                <td class="py-2.5 px-3 text-right">${formatINR(t.UnitPrice)}</td>
                <td class="py-2.5 px-3 text-right">${t.Discount}%</td>
                <td class="py-2.5 px-3 text-right font-bold" style="color: var(--brand-success);">${t.TotalAmountFormatted || formatINR(t.TotalAmount)}</td>
                <td class="py-2.5 px-3 text-[11px]">${t.Country}</td>
                <td class="py-2.5 px-3">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold border" style="${badgeStyle}">
                        ${t.OrderStatus}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

async function handleTransactionSubmit(event) {
    event.preventDefault();

    const btn = document.getElementById('btnSubmitTx');
    const btnText = document.getElementById('btnSubmitTxText');
    const btnIcon = document.getElementById('btnSubmitTxIcon');
    const alertBox = document.getElementById('txFormAlert');

    const invNo = document.getElementById('txInvoiceNo').value;
    const invDate = document.getElementById('txInvoiceDate').value;
    const prodName = document.getElementById('txProduct').value;
    const qty = parseInt(document.getElementById('txQuantity').value) || 1;
    const unitPrice = parseFloat(document.getElementById('txUnitPrice').value) || 0;
    const discount = parseInt(document.getElementById('txDiscount').value) || 0;
    const custId = document.getElementById('txCustomerID').value || "C1500";
    const country = document.getElementById('txCountry').value || "India";
    const payMethod = document.getElementById('txPaymentMethod').value || "Card";
    const status = document.getElementById('txOrderStatus').value || "Completed";

    const info = COMMODITY_CATALOG[prodName] || { category: "Retail", code: "P999" };

    const payload = {
        InvoiceNo: invNo,
        InvoiceDate: invDate,
        Description: prodName,
        StockCode: info.code,
        ProductCategory: info.category,
        Quantity: qty,
        UnitPrice: unitPrice,
        Discount: discount,
        CustomerID: custId,
        Country: country,
        PaymentMethod: payMethod,
        OrderStatus: status
    };

    if (btnText) btnText.textContent = "Ingesting & Mining DW...";
    if (btnIcon) btnIcon.classList.add('animate-spin');

    try {
        const res = await fetch('/api/transactions/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
            if (alertBox) {
                alertBox.className = "p-3 rounded-lg text-xs font-medium border flex items-center space-x-2";
                alertBox.style = "background-color: var(--brand-success-light); color: var(--brand-success); border-color: var(--brand-success-border);";
                alertBox.innerHTML = `<span>✓</span> <span>${data.message}</span>`;
                alertBox.classList.remove('hidden');
                setTimeout(() => alertBox.classList.add('hidden'), 5000);
            }

            // Refresh entire dashboard state & KPIs
            await loadDashboardData();
            updateStudioChart();
            updateMiningRules();
            loadCooccurrence();
            loadAdvancedAnalytics();
            loadDatasetStatus();
            runUpdatedSetRecommendation();

            // Auto increment next invoice
            autoSuggestInvoiceNo();
        } else {
            throw new Error(data.error || "Failed to commit transaction");
        }
    } catch (err) {
        if (alertBox) {
            alertBox.className = "p-3 rounded-lg text-xs font-medium border";
            alertBox.style = "background-color: var(--brand-danger-light); color: var(--brand-danger); border-color: var(--brand-danger-border);";
            alertBox.textContent = `Error: ${err.message}`;
            alertBox.classList.remove('hidden');
        }
    } finally {
        if (btnText) btnText.textContent = "Commit Transaction & Re-Mine";
        if (btnIcon) btnIcon.classList.remove('animate-spin');
    }
}

async function handleCSVUpload() {
    const fileInput = document.getElementById('csvFileInput');
    const alertBox = document.getElementById('uploadAlert');
    const btn = document.getElementById('btnUploadCSV');
    const btnText = document.getElementById('btnUploadCSVText');
    const btnIcon = document.getElementById('btnUploadCSVIcon');

    if (!fileInput.files || fileInput.files.length === 0) {
        if (alertBox) {
            alertBox.className = "p-3 rounded-lg text-xs font-medium border";
            alertBox.style = "background-color: var(--brand-danger-light); color: var(--brand-danger); border-color: var(--brand-danger-border);";
            alertBox.textContent = "Please select a .csv file from your computer.";
            alertBox.classList.remove('hidden');
        }
        return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);

    if (btnText) btnText.textContent = "Ingesting & Mining Models...";
    if (btnIcon) btnIcon.classList.add('animate-spin');

    try {
        const res = await fetch('/api/dataset/upload', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.success) {
            if (alertBox) {
                alertBox.className = "p-3 rounded-lg text-xs font-medium border";
                alertBox.style = "background-color: var(--brand-success-light); color: var(--brand-success); border-color: var(--brand-success-border);";
                alertBox.innerHTML = `<span>✓</span> <span>${data.message}</span>`;
                alertBox.classList.remove('hidden');
            }

            fileInput.value = "";

            // Full reload
            await loadDashboardData();
            updateStudioChart();
            updateMiningRules();
            loadCooccurrence();
            loadAdvancedAnalytics();
            loadDatasetStatus();
            runUpdatedSetRecommendation();
        } else {
            throw new Error(data.error || "Dataset upload failed");
        }
    } catch (err) {
        if (alertBox) {
            alertBox.className = "p-3 rounded-lg text-xs font-medium border";
            alertBox.style = "background-color: var(--brand-danger-light); color: var(--brand-danger); border-color: var(--brand-danger-border);";
            alertBox.textContent = `Upload Error: ${err.message}`;
            alertBox.classList.remove('hidden');
        }
    } finally {
        if (btnText) btnText.textContent = "Ingest CSV & Rebuild DW";
        if (btnIcon) btnIcon.classList.remove('animate-spin');
    }
}

async function resetDatasetToDefault() {
    const confirmed = confirm("Are you sure you want to reset the Data Warehouse to the original pristine 10,005-record dataset? All added custom transactions will be cleanly rolled back.");
    if (!confirmed) return;

    const btn = document.getElementById('btnResetDataset');
    if (btn) btn.classList.add('opacity-50', 'pointer-events-none');

    try {
        const res = await fetch('/api/dataset/reset', { method: 'POST' });
        const data = await res.json();

        if (data.success) {
            alert("✓ " + data.message);
            await loadDashboardData();
            updateStudioChart();
            updateMiningRules();
            loadCooccurrence();
            loadAdvancedAnalytics();
            loadDatasetStatus();
            runUpdatedSetRecommendation();
        } else {
            alert("Reset error: " + (data.error || "Unknown error"));
        }
    } catch (e) {
        alert("Failed to reset dataset: " + e.message);
    } finally {
        if (btn) btn.classList.remove('opacity-50', 'pointer-events-none');
    }
}

async function runUpdatedSetRecommendation() {
    const sel = document.getElementById('testRecProductSelect');
    const prod = sel ? sel.value : "Milk";

    try {
        const res = await fetch('/api/recommend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product: prod, top_n: 5 })
        });
        const json = await res.json();

        const header = document.getElementById('updatedRecHeader');
        const arrayOut = document.getElementById('updatedRecArrayOutput');
        const details = document.getElementById('updatedRecDetails');

        if (header) header.textContent = `Recommendations for ${json.input_product}:`;
        if (arrayOut) {
            if (json.recommendations && json.recommendations.length > 0) {
                arrayOut.textContent = JSON.stringify(json.recommendations).replace(/"/g, "'");
            } else {
                arrayOut.textContent = "No frequent association rules match this item in current DW.";
            }
        }

        if (details) {
            if (json.details && json.details.length > 0) {
                details.innerHTML = json.details.map((d, i) => `
                    <div class="flex items-center justify-between p-1.5 rounded border" style="background-color: var(--bg-card); border-color: var(--border-color);">
                        <span class="font-bold" style="color: var(--text-primary);">${i + 1}. ${d.product}</span>
                        <div class="font-mono text-[10px] space-x-2">
                            <span style="color: var(--brand-primary);">Lift: ${d.lift}</span>
                            <span style="color: var(--text-muted);">Conf: ${(d.confidence * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                `).join('');
            } else {
                details.innerHTML = "";
            }
        }
    } catch (e) {
        console.error("Updated set recommendation test error:", e);
    }
}
