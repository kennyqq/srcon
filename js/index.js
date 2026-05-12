// SRCON Demo - Home Page Logic (HLD Aligned)

let map = null;
let polygons = [];
let charts = {};
let currentFilter = { group: '5qi8', district: 'all', scope: 'all' };

// ============================================================
// Initialization
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initMap().then(() => {
    initCharts();
    renderAll();
    bindEvents();
  });
});

// ============================================================
// Map
// ============================================================
async function initMap() {
  return new Promise((resolve) => {
    AMapLoader.load({
      key: 'a94aaf734ef8c87f8c6c45559c28a4fd',
      version: '2.0',
      plugins: ['AMap.Scale']
    }).then((AMap) => {
      map = new AMap.Map('map', {
        zoom: 12,
        center: [121.465, 31.22],
        mapStyle: 'amap://styles/dark',
        viewMode: '2D'
      });
      map.addControl(new AMap.Scale({ position: 'LB' }));
      resolve();
    }).catch(err => {
      console.error('Map load failed:', err);
      document.getElementById('map').innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#64748b;">' +
        '<i class="fas fa-exclamation-triangle" style="margin-right:8px;"></i>地图加载失败</div>';
      resolve();
    });
  });
}

function renderMap() {
  if (!map) return;
  polygons.forEach(p => { if (map) map.remove(p); });
  polygons = [];

  const grids = SRCON_DATA.getFilteredGrids(currentFilter.district, currentFilter.group);
  const qk = currentFilter.group === 'all' ? '5qi8' : currentFilter.group;

  grids.forEach(g => {
    const stats = g.stats[qk];
    const rate = stats.rate;
    const color = getRateColor(rate);

    // Main polygon with glow effect
    const polygon = new AMap.Polygon({
      path: g.geometry.coordinates[0].map(coord => [coord[0], coord[1]]),
      fillColor: color,
      fillOpacity: 0.35,
      strokeColor: color,
      strokeWeight: 2,
      strokeOpacity: 0.9,
      cursor: 'pointer'
    });
    map.add(polygon);

    // Glow border (outer)
    const glowPolygon = new AMap.Polygon({
      path: g.geometry.coordinates[0].map(coord => [coord[0], coord[1]]),
      fillColor: color,
      fillOpacity: 0.05,
      strokeColor: color,
      strokeWeight: 6,
      strokeOpacity: 0.2,
      cursor: 'pointer'
    });
    map.add(glowPolygon);

    // Grid name label
    const label = new AMap.Text({
      text: `<div style="color:#e2e8f0;font-size:12px;font-weight:500;text-shadow:0 0 6px rgba(0,0,0,0.8);white-space:nowrap;padding:2px 6px;background:rgba(10,22,40,0.6);border-radius:4px;border:1px solid rgba(0,212,255,0.15);">${g.name}</div>`,
      position: g.center,
      offset: new AMap.Pixel(0, -10),
      anchor: 'center'
    });
    map.add(label);

    // Tooltip on click
    polygon.on('click', (e) => {
      const info = `
        <div style="padding:16px;min-width:240px;">
          <div style="font-size:16px;font-weight:600;margin-bottom:4px;">${g.name}</div>
          <div style="color:#94a3b8;font-size:12px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.08);">${g.district} / 5QI=${qk.replace('qi','')}</div>
          <table style="width:100%;font-size:12px;line-height:2;color:#94a3b8;">
            <tr><td>对象数量</td><td style="color:#e2e8f0;text-align:right;font-weight:500;">${COMMON.formatNumber(stats.users)}</td></tr>
            <tr><td>通讯事件数</td><td style="color:#e2e8f0;text-align:right;font-weight:500;">${COMMON.formatNumber(stats.events)}</td></tr>
            <tr><td>质差事件数</td><td style="color:#e2e8f0;text-align:right;font-weight:500;">${COMMON.formatNumber(stats.qualityEvents)}</td></tr>
            <tr><td>质差比例</td><td style="color:${color};text-align:right;font-weight:600;">${rate}%</td></tr>
            <tr><td>涉及小区数</td><td style="color:#e2e8f0;text-align:right;font-weight:500;">${stats.cells}</td></tr>
            <tr><td>主服务小区</td><td style="color:#e2e8f0;text-align:right;font-weight:500;">${stats.mainCell}</td></tr>
          </table>
          <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);font-size:11px;color:#64748b;">数据口径：真实 AOI + 小区公参 + 五元组聚合 + 规则重构</div>
        </div>
      `;
      const infoWindow = new AMap.InfoWindow({
        content: info,
        offset: new AMap.Pixel(0, -10),
        closeWhenClickMap: true
      });
      infoWindow.open(map, e.lnglat);
    });

    polygons.push(polygon, glowPolygon, label);
  });

  if (polygons.length > 0) {
    map.setFitView(polygons.filter(p => p instanceof AMap.Polygon), false, [80, 80, 80, 80]);
  }
}

function getRateColor(rate) {
  if (rate <= 2) return '#22c55e';
  if (rate <= 4) return '#84cc16';
  if (rate <= 6) return '#eab308';
  if (rate <= 8) return '#f97316';
  return '#ef4444';
}

// ============================================================
// Charts
// ============================================================
function initCharts() {
  charts.business = echarts.init(document.getElementById('chartBusiness'));
  charts.abnormal = echarts.init(document.getElementById('chartAbnormal'));
  charts.rootcause = echarts.init(document.getElementById('chartRootcause'));
  window.addEventListener('resize', () => Object.values(charts).forEach(c => c && c.resize()));
}

function renderCharts() {
  const d = SRCON_DATA.homeCharts;
  const colors = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#64748b'];

  const mkOpt = (data) => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: '#0d1e36',
      borderColor: 'rgba(0,212,255,0.2)',
      textStyle: { color: '#e2e8f0', fontSize: 11 }
    },
    legend: {
      orient: 'vertical',
      right: 0,
      top: 'middle',
      textStyle: { color: '#94a3b8', fontSize: 10 },
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 6,
      formatter: name => {
        const item = data.find(x => x.name === name);
        const v = item ? item.value : 0;
        const short = name.length > 8 ? name.substring(0, 7) + '…' : name;
        return `${short}  ${v}%`;
      }
    },
    series: [{
      type: 'pie',
      radius: ['42%', '68%'],
      center: ['30%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 4, borderColor: '#0a1628', borderWidth: 2 },
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 12, fontWeight: 'bold', color: '#e2e8f0' }
      },
      labelLine: { show: false },
      data: data.map((item, i) => ({ ...item, itemStyle: { color: colors[i % colors.length] } }))
    }]
  });

  charts.business.setOption(mkOpt(d.business), true);
  charts.abnormal.setOption(mkOpt(d.abnormal), true);
  charts.rootcause.setOption(mkOpt(d.rootcause), true);
}

// ============================================================
// KPI
// ============================================================
function renderKPI() {
  const qk = currentFilter.group === 'all' ? '5qi8' : currentFilter.group;
  const kpi = SRCON_DATA.aggregateKPI(currentFilter.district, qk);
  document.getElementById('kpiEvents').textContent = COMMON.formatNumber(kpi.events);
  document.getElementById('kpiUsers').textContent = COMMON.formatNumber(kpi.users);
  document.getElementById('kpiQualityEvents').textContent = COMMON.formatNumber(kpi.qualityEvents);
  document.getElementById('kpiRate').textContent = kpi.rate + '%';
  const rateEl = document.getElementById('kpiRate');
  rateEl.style.color = getRateColor(parseFloat(kpi.rate));
}

// ============================================================
// Optimization Bars
// ============================================================
function renderOptimization() {
  const opt = SRCON_DATA.optimizationSummary;
  document.getElementById('optTotal').textContent = COMMON.formatNumber(opt.total);
  const maxCount = Math.max(...opt.types.map(t => t.count));
  const barColors = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

  document.getElementById('optBars').innerHTML = opt.types.map((t, i) => {
    const pct = (t.count / maxCount * 100).toFixed(1);
    return `
      <div class="opt-bar-item">
        <span class="opt-bar-label">${t.name}</span>
        <div class="opt-bar-track">
          <div class="opt-bar-fill" style="width:${pct}%;background:${barColors[i % barColors.length]};"></div>
        </div>
        <span class="opt-bar-value">${COMMON.formatNumber(t.count)}</span>
      </div>
    `;
  }).join('');
}

// ============================================================
// Work Orders (Table)
// ============================================================
function renderWorkOrders() {
  const qk = currentFilter.group === 'all' ? '5qi8' : currentFilter.group;
  const orders = SRCON_DATA.workOrders[qk] || [];
  const container = document.getElementById('workOrderList');

  if (orders.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:#64748b;padding:40px 0;font-size:12px;">暂无重点工单</div>';
    return;
  }

  container.innerHTML = orders.slice(0, 8).map(o => `
    <div class="wo-table-row" onclick="goToDetail('${o.id}')">
      <span class="wo-id">${o.id}</span>
      <span class="wo-events">${o.qualityEvents}</span>
      <span class="wo-type">${o.qualityType}</span>
      <span class="wo-cell">${o.mainCell}</span>
      <span class="wo-action" onclick="event.stopPropagation();goToDetail('${o.id}')">处理</span>
    </div>
  `).join('');
}

function goToDetail(orderId) {
  const qk = currentFilter.group === 'all' ? '5qi8' : currentFilter.group;
  const order = (SRCON_DATA.workOrders[qk] || []).find(o => o.id === orderId);
  if (!order) return;
  const params = new URLSearchParams({ caseId: orderId, grid: order.gridId, group: qk, area: order.area });
  window.location.href = `assurance.html?${params.toString()}`;
}

// ============================================================
// Agent Panel
// ============================================================
function showAgent(type) {
  const content = SRCON_DATA.agentContent[type];
  if (!content) return;
  document.getElementById('agentTitle').textContent = content.title;
  document.getElementById('agentBody').innerHTML = `
    <div style="margin-bottom:16px;">
      <div style="font-size:12px;font-weight:600;color:#e2e8f0;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
        <span style="width:3px;height:14px;background:#00d4ff;border-radius:2px;display:inline-block;"></span>结论
      </div>
      <div style="background:rgba(0,212,255,0.08);border-left:3px solid #00d4ff;padding:10px 12px;border-radius:0 6px 6px 0;font-size:12px;color:#e2e8f0;line-height:1.6;">${content.conclusion}</div>
    </div>
    <div style="margin-bottom:16px;">
      <div style="font-size:12px;font-weight:600;color:#e2e8f0;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
        <span style="width:3px;height:14px;background:#00d4ff;border-radius:2px;display:inline-block;"></span>证据
      </div>
      <ul style="padding-left:16px;font-size:12px;color:#94a3b8;line-height:1.8;">
        ${content.evidence.map(e => `<li>${e}</li>`).join('')}
      </ul>
    </div>
    <div style="margin-bottom:16px;">
      <div style="font-size:12px;font-weight:600;color:#e2e8f0;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
        <span style="width:3px;height:14px;background:#00d4ff;border-radius:2px;display:inline-block;"></span>审核项
      </div>
      <p style="font-size:12px;color:#94a3b8;line-height:1.8;">${content.audit}</p>
    </div>
    <div>
      <div style="font-size:12px;font-weight:600;color:#e2e8f0;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
        <span style="width:3px;height:14px;background:#00d4ff;border-radius:2px;display:inline-block;"></span>深度解读
      </div>
      <p style="font-size:12px;color:#94a3b8;line-height:1.8;">${content.detail}</p>
    </div>
  `;
  document.getElementById('agentOverlay').classList.add('open');
}

function hideAgent() {
  document.getElementById('agentOverlay').classList.remove('open');
}

// ============================================================
// Events
// ============================================================
function bindEvents() {
  // Scope toggle
  document.querySelectorAll('.scope-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.scope-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter.scope = btn.dataset.value;
      renderAll();
    });
  });

  // Time toggle
  document.querySelectorAll('.time-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Filters
  document.getElementById('groupSelect').addEventListener('change', e => {
    currentFilter.group = e.target.value;
    renderAll();
  });
  document.getElementById('districtSelect').addEventListener('change', e => {
    currentFilter.district = e.target.value;
    renderAll();
  });

  // Agent
  document.getElementById('agentBtn').addEventListener('click', () => showAgent('policy'));
  document.getElementById('closeAgent').addEventListener('click', hideAgent);
  document.getElementById('agentOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('agentOverlay')) hideAgent();
  });
}

// ============================================================
// Render All
// ============================================================
function renderAll() {
  renderKPI();
  renderCharts();
  renderMap();
  renderWorkOrders();
  renderOptimization();
}
