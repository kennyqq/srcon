/* ============================================
   SRCON Demo - Assurance Page Logic
   ============================================ */

(function() {
  'use strict';

  const DATA = window.SRCON_DATA;
  let amap = null;
  let chartProblem = null;
  let chartRSRP = null, chartSINR = null, chartDelay = null;

  function init() {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('caseId') || params.get('orderId');
    const qk = params.get('group') || '5qi8';
    const woList = DATA.workOrders[qk] || [];
    const wo = orderId ? woList.find(w => w.id === orderId) : woList[0];
    if (!wo) {
      document.querySelector('.analysis-dashboard').innerHTML = '<div style="color:#9ca3af;text-align:center;padding:60px;">未找到工单数据</div>';
      return;
    }

    const grid = DATA.grids.find(g => g.id === wo.gridId) || DATA.grids[0];
    const stats = grid.stats[qk] || {};

    // Breadcrumb
    document.getElementById('bcDistrict').textContent = wo.gridName || '黄浦区';
    document.getElementById('bcOrderId').textContent = wo.id;

    // WO Meta
    document.getElementById('woId').textContent = wo.id;
    document.getElementById('woCell').textContent = wo.mainCell || stats.mainCell || '--';

    // Mini KPI
    document.getElementById('miniEvents').textContent = COMMON.formatNumber(wo.qualityEvents || stats.qualityEvents || 0);
    document.getElementById('miniQuality').textContent = COMMON.formatNumber(wo.qualityEvents || stats.qualityEvents || 0);
    const rate = wo.rate || stats.rate || 0;
    document.getElementById('miniRate').textContent = rate + '%';

    // Problem donut (mock from quality type distribution)
    chartProblem = echarts.init(document.getElementById('chartProblem'));
    renderProblemDonut(wo, woList);

    // Metrics replay
    chartRSRP = echarts.init(document.getElementById('chartRSRP'));
    chartSINR = echarts.init(document.getElementById('chartSINR'));
    chartDelay = echarts.init(document.getElementById('chartDelay'));
    renderMetricChart(chartRSRP, 'RSRP', -105, generateMetricData(-118, -88, -105, 20));
    renderMetricChart(chartSINR, 'SINR', 3, generateMetricData(-2, 22, 3, 20));
    renderMetricChart(chartDelay, 'Delay', 100, generateMetricData(30, 220, 100, 20));

    // Map
    initMap(grid);

    // Signaling
    renderTraceFlow();
    renderTraceAnalysis(wo);

    // Right panel
    renderCIOList(grid, wo);
    renderStrategyGrid(wo, grid, qk);

    // Events
    document.getElementById('genScriptBtn').addEventListener('click', () => alert('正在生成优化脚本...'));
    document.getElementById('genStrategyBtn').addEventListener('click', () => alert('正在生成业务保障策略...'));

    window.addEventListener('resize', () => {
      chartProblem && chartProblem.resize();
      chartRSRP && chartRSRP.resize();
      chartSINR && chartSINR.resize();
      chartDelay && chartDelay.resize();
    });
  }

  function renderProblemDonut(wo, woList) {
    // Derive distribution from woList quality types
    const typeCounts = {};
    woList.forEach(w => { typeCounts[w.qualityType] = (typeCounts[w.qualityType] || 0) + 1; });
    const data = Object.keys(typeCounts).map(k => ({ value: typeCounts[k], name: k }));
    if (data.length === 0) {
      data.push({ value: 1, name: '异常掉线' }, { value: 1, name: '乒乓切换' }, { value: 1, name: '切换失败' });
    }

    chartProblem.setOption({
      tooltip: { trigger: 'item' },
      series: [{
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '55%'],
        avoidLabelOverlap: false,
        label: { show: true, fontSize: 10, color: '#9ca3af' },
        labelLine: { show: true, lineStyle: { color: 'rgba(255,255,255,0.2)' } },
        data,
        color: ['#eab308', '#8b5cf6', '#ef4444', '#06b6d4', '#22c55e']
      }]
    });
  }

  function generateMetricData(min, max, threshold, points) {
    const data = [];
    let val = (min + max) / 2;
    for (let i = 0; i < points; i++) {
      val += (Math.random() - 0.5) * (max - min) * 0.15;
      val = Math.max(min, Math.min(max, val));
      const isAbnormal = (threshold < 0 && val < threshold) || (threshold > 0 && val > threshold);
      data.push({ value: parseFloat(val.toFixed(1)), abnormal: isAbnormal });
    }
    return data;
  }

  function renderMetricChart(chart, name, threshold, data) {
    const xData = data.map((_, i) => i);
    const seriesData = data.map(d => d.value);
    const abnormalPoints = data.map((d, i) => d.abnormal ? d.value : null);

    chart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: 0, right: 0, top: 4, bottom: 0 },
      xAxis: { type: 'category', data: xData, show: false },
      yAxis: { type: 'value', show: false, min: Math.min(...seriesData) * 0.95, max: Math.max(...seriesData) * 1.05 },
      series: [
        {
          type: 'line',
          data: seriesData,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 1.5, color: '#3b82f6' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(0,212,255,0.2)' },
              { offset: 1, color: 'rgba(0,212,255,0)' }
            ])
          }
        },
        {
          type: 'line',
          data: Array(data.length).fill(threshold),
          symbol: 'none',
          lineStyle: { width: 1, type: 'dashed', color: '#ef4444' }
        },
        {
          type: 'scatter',
          data: abnormalPoints,
          symbolSize: 6,
          itemStyle: { color: '#8b5cf6' }
        }
      ]
    });
  }

  function initMap(grid) {
    AMapLoader.load({
      key: 'a94aaf734ef8c87f8c6c45559c28a4fd',
      version: '2.0',
      plugins: []
    }).then(AMap => {
      amap = new AMap.Map('map', {
        center: grid.center || [121.4737, 31.2304],
        zoom: 14,
        mapStyle: 'amap://styles/dark'
      });

      // Draw grid polygon
      if (grid && grid.geometry && grid.geometry.coordinates && grid.geometry.coordinates[0] && grid.geometry.coordinates[0].length >= 3) {
        const path = grid.geometry.coordinates[0].map(c => [c[0], c[1]]);
        const poly = new AMap.Polygon({
          path,
          strokeColor: '#3b82f6',
          strokeWeight: 2,
          fillColor: '#3b82f6',
          fillOpacity: 0.1
        });
        amap.add(poly);
        amap.setFitView([poly], false, [60, 60, 60, 60]);

        // Grid label
        if (grid.center) {
          const label = new AMap.Text({
            text: `<div style="color:#ffffff;font-size:13px;font-weight:500;text-shadow:0 0 6px rgba(0,0,0,0.8);white-space:nowrap;padding:2px 6px;background:rgba(10,22,40,0.6);border-radius:4px;border:1px solid rgba(0,212,255,0.15);">${grid.name || ''}</div>`,
            position: grid.center,
            offset: new AMap.Pixel(0, -10),
            anchor: 'center'
          });
          amap.add(label);
        }
      }

      // Cell marker (red = quality issue)
      const marker = new AMap.CircleMarker({
        center: grid.center,
        radius: 18,
        fillColor: '#ef4444',
        fillOpacity: 0.7,
        strokeColor: '#ef4444',
        strokeWeight: 2
      });
      amap.add(marker);
    }).catch(console.error);
  }

  function renderTraceFlow() {
    const steps = [
      { title: '初始接入', detail: 'RRC Setup\nSucc' },
      { title: 'DU能力上报', detail: 'UE Cap Report\n5QI=8' },
      { title: 'L2上下文释放', detail: 'Rel Cause\nRadioLinkFail', highlight: true },
      { title: '5G同系统切换发起', detail: 'HO Required\nN2 Msg' },
      { title: '切换进入', detail: 'HO Notify\nACK' },
      { title: 'DU能力上报', detail: 'UE Cap Report\n5QI=8' }
    ];
    const container = document.getElementById('traceFlow');
    container.innerHTML = steps.map((s, i) => `
      <div class="trace-step">
        <div class="trace-step-box${s.highlight ? ' highlight' : ''}">
          <div class="trace-step-title">${s.title}</div>
          <div class="trace-step-detail">${s.detail.replace(/\n/g, '<br>')}</div>
        </div>
        ${i < steps.length - 1 ? '<div class="trace-arrow"><i class="fas fa-chevron-right"></i></div>' : ''}
      </div>
    `).join('');
  }

  function renderTraceAnalysis(wo) {
    const abnormalList = ['乒乓/频繁切换', 'RSRP波动', 'SINR陡降'];
    const rootList = ['邻区CIO配置不合理', '切换门限过宽', '覆盖重叠度高'];

    document.getElementById('abnormalExplain').innerHTML = abnormalList.map(a => `<li>${a}</li>`).join('');
    document.getElementById('rootcauseExplain').innerHTML = rootList.map(r => `<li>${r}</li>`).join('');
  }

  function renderCIOList(grid, wo) {
    const mainCell = wo.mainCell || '5838088/1025';
    const list = [
      { name: '邻区CIO复核', detail: `小区 ${mainCell} 与目标小区之间CIO=-3dB，建议调整为-1dB以提升切换成功率。` },
      { name: 'A3门限复核', detail: '当前A3-offset=-2dB，事件触发过于频繁，建议收紧至-3dB减少乒乓切换。' }
    ];
    document.getElementById('cioList').innerHTML = list.map(item => `
      <div class="cio-item">
        <div class="cio-item-header">
          <span class="cio-item-title">${item.name}</span>
          <button class="cio-interpret-btn">智能体解读</button>
        </div>
        <div class="cio-detail">${item.detail}</div>
        <div class="cio-actions">
          <button class="cio-action-btn approve"><i class="fas fa-check"></i></button>
          <button class="cio-action-btn reject"><i class="fas fa-times"></i></button>
        </div>
      </div>
    `).join('');
  }

  function renderStrategyGrid(wo, grid, qk) {
    const stats = grid.stats[qk] || {};
    const items = [
      { label: '策略ID', value: `OP-${String(Math.floor(Math.random()*9000)+1000)}` },
      { label: '生效时间段', value: '17:00-18:00' },
      { label: '当前5QI', value: '5QI=' + (qk.replace('qi','') || '8') },
      { label: 'RFSP', value: 'Index=5' },
      { label: '保障业务', value: wo.qualityType || '直播/游戏' },
      { label: '优先级', value: 'VIP' }
    ];
    document.getElementById('strategyGrid').innerHTML = items.map(i => `
      <div class="strategy-item">
        <div class="strategy-item-label">${i.label}</div>
        <div class="strategy-item-value">${i.value}</div>
      </div>
    `).join('');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
