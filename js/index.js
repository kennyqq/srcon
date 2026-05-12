// SRCON Demo - Home Page Logic

let map = null;
let polygons = [];
let charts = {};
let currentFilter = {
  group: '5qi8',
  district: 'all',
  scope: 'all'
};

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
      plugins: ['AMap.Scale', 'AMap.ToolBar']
    }).then((AMap) => {
      map = new AMap.Map('map', {
        zoom: 12,
        center: [121.465, 31.22],
        mapStyle: 'amap://styles/dark',
        viewMode: '2D'
      });
      
      map.addControl(new AMap.Scale({ position: 'LB' }));
      map.addControl(new AMap.ToolBar({ position: 'LB' }));
      
      resolve();
    }).catch(err => {
      console.error('Map load failed:', err);
      document.getElementById('map').innerHTML = 
        '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;">' +
        '<i class="fas fa-exclamation-triangle" style="margin-right:8px;"></i>地图加载失败，请检查网络连接</div>';
      resolve();
    });
  });
}

function renderMap() {
  if (!map) return;
  
  // Clear existing polygons
  polygons.forEach(p => {
    if (map) map.remove(p);
  });
  polygons = [];
  
  const grids = SRCON_DATA.getFilteredGrids(currentFilter.district, currentFilter.group);
  const qk = currentFilter.group === 'all' ? '5qi8' : currentFilter.group;
  
  grids.forEach(g => {
    const stats = g.stats[qk];
    const rate = stats.rate;
    const color = COMMON.getColorByRate(rate);
    
    const polygon = new AMap.Polygon({
      path: g.geometry.coordinates[0].map(coord => [coord[0], coord[1]]),
      fillColor: color,
      fillOpacity: 0.5,
      strokeColor: '#ffffff',
      strokeWeight: 1,
      strokeOpacity: 0.6,
      cursor: 'pointer'
    });
    
    map.add(polygon);
    
    // Tooltip on click
    polygon.on('click', (e) => {
      const info = `
        <div class="map-tooltip">
          <div class="tooltip-title">${g.name}</div>
          <div class="tooltip-sub">${g.district} / ${qk === 'all' ? '全部' : qk.toUpperCase().replace('QI', 'QI=')}</div>
          <div class="tooltip-row"><span class="label">对象数量</span><span class="value">${COMMON.formatNumber(stats.users)}</span></div>
          <div class="tooltip-row"><span class="label">通讯事件数</span><span class="value">${COMMON.formatNumber(stats.events)}</span></div>
          <div class="tooltip-row"><span class="label">质差事件数</span><span class="value">${COMMON.formatNumber(stats.qualityEvents)}</span></div>
          <div class="tooltip-row"><span class="label">质差比例</span><span class="value" style="color:${color};">${rate}%</span></div>
          <div class="tooltip-row"><span class="label">涉及小区数</span><span class="value">${stats.cells}</span></div>
          <div class="tooltip-row"><span class="label">主服务小区</span><span class="value">${stats.mainCell}</span></div>
          <div class="tooltip-footer">数据口径：真实 AOI + 小区公参 + 五元组聚合 + 规则重构</div>
        </div>
      `;
      
      const infoWindow = new AMap.InfoWindow({
        content: info,
        offset: new AMap.Pixel(0, -10),
        closeWhenClickMap: true
      });
      infoWindow.open(map, e.lnglat);
    });
    
    polygons.push(polygon);
  });
  
  // Fit view to all polygons
  if (polygons.length > 0) {
    map.setFitView(polygons.filter(p => p instanceof AMap.Polygon), false, [60, 60, 60, 60]);
  }
}

// ============================================================
// Charts
// ============================================================
function initCharts() {
  charts.business = echarts.init(document.getElementById('chartBusiness'));
  charts.abnormal = echarts.init(document.getElementById('chartAbnormal'));
  charts.rootcause = echarts.init(document.getElementById('chartRootcause'));
  
  window.addEventListener('resize', () => {
    Object.values(charts).forEach(c => c.resize());
  });
}

function renderCharts() {
  const data = SRCON_DATA.homeCharts;
  
  charts.business.setOption(COMMON.createDonutOption(
    '智能板业务质差类型分布',
    data.business
  ));
  
  charts.abnormal.setOption(COMMON.createDonutOption(
    '异常模式类型分布',
    data.abnormal
  ));
  
  charts.rootcause.setOption(COMMON.createDonutOption(
    '网络根因类型分布',
    data.rootcause
  ));
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
  
  // Rate color
  const rateEl = document.getElementById('kpiRate');
  const rateVal = parseFloat(kpi.rate);
  rateEl.style.color = COMMON.getColorByRate(rateVal);
}

// ============================================================
// Optimization Summary
// ============================================================
function renderOptimization() {
  const opt = SRCON_DATA.optimizationSummary;
  document.getElementById('optTotal').textContent = COMMON.formatNumber(opt.total);
  
  const container = document.getElementById('optTypes');
  container.innerHTML = opt.types.map(t => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:12px;">
      <span style="color:var(--text-secondary);">${t.name}</span>
      <span style="color:var(--text-primary);font-weight:500;">${COMMON.formatNumber(t.count)}</span>
    </div>
  `).join('');
}

// ============================================================
// Work Orders
// ============================================================
function renderWorkOrders() {
  const qk = currentFilter.group === 'all' ? '5qi8' : currentFilter.group;
  const orders = SRCON_DATA.workOrders[qk] || [];
  const container = document.getElementById('workOrderList');
  
  if (orders.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px 0;">暂无重点工单</div>';
    return;
  }
  
  container.innerHTML = orders.map(o => `
    <div class="work-order-item" onclick="goToDetail('${o.id}')">
      <div class="wo-header">
        <span class="wo-id">${o.id}</span>
        <span class="wo-badge">${o.qualityType}</span>
      </div>
      <div class="wo-info">
        <div><i class="fas fa-map-marker-alt" style="color:var(--accent-blue);margin-right:4px;"></i>${o.gridName}</div>
        <div>质差事件: <strong style="color:var(--accent-red);">${COMMON.formatNumber(o.qualityEvents)}</strong> (${o.rate}%)</div>
        <div>主服小区: ${o.mainCell}</div>
      </div>
      <div class="wo-actions">
        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();goToDetail('${o.id}')">处理</button>
        <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();">忽略</button>
      </div>
    </div>
  `).join('');
}

function goToDetail(orderId) {
  const qk = currentFilter.group === 'all' ? '5qi8' : currentFilter.group;
  const order = (SRCON_DATA.workOrders[qk] || []).find(o => o.id === orderId);
  if (!order) return;
  
  const params = new URLSearchParams({
    caseId: orderId,
    grid: order.gridId,
    group: currentFilter.group,
    area: order.area
  });
  window.location.href = `assurance.html?${params.toString()}`;
}

// ============================================================
// Agent Panel
// ============================================================
function showAgent(type) {
  const content = SRCON_DATA.agentContent[type];
  if (!content) return;
  
  document.getElementById('agentTitle').textContent = content.title;
  
  const body = document.getElementById('agentBody');
  body.innerHTML = `
    <div class="agent-section">
      <div class="section-title">结论</div>
      <div class="conclusion">${content.conclusion}</div>
    </div>
    <div class="agent-section">
      <div class="section-title">证据</div>
      <ul>
        ${content.evidence.map(e => `<li>${e}</li>`).join('')}
      </ul>
    </div>
    <div class="agent-section">
      <div class="section-title">审核项</div>
      <p>${content.audit}</p>
    </div>
    <div class="agent-section">
      <div class="section-title">深度解读</div>
      <p>${content.detail}</p>
    </div>
  `;
  
  document.getElementById('agentPanel').classList.add('open');
}

function hideAgent() {
  document.getElementById('agentPanel').classList.remove('open');
}

// ============================================================
// Events
// ============================================================
function bindEvents() {
  // Sidebar buttons
  document.querySelectorAll('.sidebar-btn[data-panel]').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = btn.dataset.panel;
      if (panel === 'filter') {
        document.getElementById('filterPanel').classList.toggle('open');
      } else if (panel === 'agent') {
        showAgent('policy');
      } else if (panel === 'reset') {
        resetFilters();
      }
    });
  });
  
  // Close filter panel when clicking outside
  document.addEventListener('click', (e) => {
    const filterPanel = document.getElementById('filterPanel');
    const sidebar = document.querySelector('.left-sidebar');
    if (filterPanel.classList.contains('open') && 
        !filterPanel.contains(e.target) && 
        !sidebar.contains(e.target)) {
      filterPanel.classList.remove('open');
    }
  });
  
  // Filter panel
  document.getElementById('groupSelect').addEventListener('change', (e) => {
    currentFilter.group = e.target.value;
    renderAll();
  });
  
  document.getElementById('districtSelect').addEventListener('change', (e) => {
    currentFilter.district = e.target.value;
    renderAll();
  });
  
  document.getElementById('applyFilter').addEventListener('click', () => {
    renderAll();
  });
  
  // Toggle group
  document.querySelectorAll('.toggle-group .toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.parentElement.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter.scope = btn.dataset.value;
    });
  });
  
  // Agent detail links
  document.querySelectorAll('.chart-detail[data-agent]').forEach(link => {
    link.addEventListener('click', () => {
      showAgent(link.dataset.agent);
    });
  });
  
  // Close agent
  document.getElementById('closeAgent').addEventListener('click', hideAgent);
  
  // Deep analysis
  document.getElementById('deepAnalysis').addEventListener('click', () => {
    alert('深度解读功能需要连接大模型后端服务');
  });
}

function resetFilters() {
  currentFilter = { group: '5qi8', district: 'all', scope: 'all' };
  document.getElementById('groupSelect').value = '5qi8';
  document.getElementById('districtSelect').value = 'all';
  document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.toggle-btn[data-value="all"]').classList.add('active');
  renderAll();
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
  updateBreadcrumb();
}

function updateBreadcrumb() {
  const parts = ['全网质差事件识别'];
  if (currentFilter.district !== 'all') {
    parts.push(currentFilter.district === 'huangpu' ? '黄浦区' : '静安区');
  }
  if (currentFilter.group !== 'all') {
    parts.push(currentFilter.group.toUpperCase().replace('QI', 'QI='));
  }
  document.getElementById('breadcrumbText').textContent = parts.join(' / ');
}
