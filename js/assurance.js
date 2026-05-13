/* ============================================
   SRCON Demo - Assurance Page Logic
   ============================================ */

(function() {
  'use strict';

  let DATA = null;
  let amap = null;
  let chartProblem = null;
  let chartRSRP = null, chartSINR = null, chartDelay = null;
  let currentAssuranceData = null;

  function getData() {
    // const-declared globals don't attach to window, so check both safely
    if (typeof window !== 'undefined' && window.SRCON_DATA) return window.SRCON_DATA;
    if (typeof SRCON_DATA !== 'undefined') return SRCON_DATA;
    return null;
  }

  function init() {
    DATA = getData();
    if (!DATA) {
      setTimeout(init, 150);
      return;
    }
    try {
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
    document.getElementById('miniEvents').textContent = COMMON.formatNumber(wo.events || stats.events || 0);
    document.getElementById('miniQuality').textContent = COMMON.formatNumber(wo.qualityEvents || stats.qualityEvents || 0);
    const rate = wo.rate || stats.rate || 0;
    document.getElementById('miniRate').textContent = rate + '%';

    // Problem donut
    chartProblem = echarts.init(document.getElementById('chartProblem'));
    renderProblemDonut(wo, woList);

    // Assurance detail data
    const ad = DATA.assurance[wo.id] || {};
    currentAssuranceData = ad;

    // Metrics replay
    chartRSRP = echarts.init(document.getElementById('chartRSRP'));
    chartSINR = echarts.init(document.getElementById('chartSINR'));
    chartDelay = echarts.init(document.getElementById('chartDelay'));
    const trendData = ad.trend || [];
    const qe = ad.qualityEvents || [];
    renderMetricChart(chartRSRP, 'RSRP', -105, trendData, 'rsrp', qe, 'rsrp');
    renderMetricChart(chartSINR, 'SINR', 3, trendData, 'sinr', qe, 'sinr');
    renderMetricChart(chartDelay, 'Delay', 100, trendData, 'rlcDelay', qe, 'rlcDelay');

    // Map (with quality event markers)
    initMap(grid, qe);

    // Signaling
    renderTraceFlow(ad.signalTrace || []);
    renderTraceAnalysis(wo, ad);

    // Right panel
    renderCIOList(grid, wo);
    renderStrategyGrid(wo, grid, qk);

    // Events
    document.getElementById('genScriptBtn').addEventListener('click', () => COMMON.showToast('已生成脚本草案，等待人工复核'));
    document.getElementById('genStrategyBtn').addEventListener('click', () => COMMON.showToast('已生成保障策略草案，等待人工审核'));

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        chartProblem && chartProblem.resize();
        chartRSRP && chartRSRP.resize();
        chartSINR && chartSINR.resize();
        chartDelay && chartDelay.resize();
      }, 150);
    });
    } catch (err) {
      console.error('Assurance init error:', err);
      const d = getData();
      console.error('SRCON_DATA exists:', !!d);
      console.error('workOrders exists:', d && d.workOrders ? 'yes' : 'no');
      document.querySelector('.analysis-dashboard').innerHTML = '<div style="color:#ef4444;text-align:center;padding:60px;">页面加载异常：' + (err && err.message ? err.message : String(err)) + '</div>';
    }
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

  function renderMetricChart(chart, name, threshold, trendData, key, qualityEvents, qeKey) {
    let data = [];
    if (trendData && trendData.length > 0) {
      data = trendData.map(t => {
        const val = t[key];
        const abnormal = (threshold < 0 && val < threshold) || (threshold > 0 && val > threshold);
        return { value: val, abnormal };
      });
    } else {
      data = generateMetricData(threshold - 15, threshold + 25, threshold, 20);
    }
    const xData = data.map((_, i) => i);
    const seriesData = data.map(d => d.value);
    // Abnormal scatter points sourced from unified qualityEvents (same source as map markers & modal)
    const qePoints = Array(data.length).fill(null);
    (qualityEvents || []).forEach((ev, idx) => {
      const xPos = Math.min(data.length - 1, Math.floor((idx / Math.max(qualityEvents.length, 1)) * data.length) + 1);
      qePoints[xPos] = ev.metrics[qeKey];
    });
    const abnormalPoints = qePoints;

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
              { offset: 0, color: 'rgba(59,130,246,0.2)' },
              { offset: 1, color: 'rgba(59,130,246,0)' }
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
          itemStyle: { color: '#38bdf8' }
        }
      ]
    });
  }

  function initMap(grid, qualityEvents) {
    AMapLoader.load({
      key: (typeof SRCON_CONFIG !== 'undefined' && SRCON_CONFIG.amapKey) ? SRCON_CONFIG.amapKey : 'a94aaf734ef8c87f8c6c45559c28a4fd',
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
            text: `<div style="color:#ffffff;font-size:13px;font-weight:500;text-shadow:0 0 6px rgba(0,0,0,0.8);white-space:nowrap;padding:2px 6px;background:rgba(10,22,40,0.6);border-radius:4px;border:1px solid rgba(59,130,246,0.15);">${grid.name || ''}</div>`,
            position: grid.center,
            offset: new AMap.Pixel(0, -10),
            anchor: 'center'
          });
          amap.add(label);
        }
      }

      // Quality event markers (blue dots from unified qualityEvents)
      const abnormalEvents = (qualityEvents || []).filter(e => e.abnormal);
      abnormalEvents.forEach((ev, idx) => {
        const m = new AMap.CircleMarker({
          center: [ev.lng, ev.lat],
          radius: 10,
          fillColor: '#38bdf8',
          fillOpacity: 0.85,
          strokeColor: '#e0f2fe',
          strokeWeight: 2
        });
        amap.add(m);
        const info = new AMap.Text({
          text: `<div style="color:#38bdf8;font-size:11px;font-weight:500;text-shadow:0 0 4px rgba(0,0,0,0.9);white-space:nowrap;">${ev.eventId}</div>`,
          position: [ev.lng, ev.lat],
          offset: new AMap.Pixel(0, -18),
          anchor: 'center'
        });
        amap.add(info);
      });
    }).catch(console.error);
  }

  function renderTraceFlow(traceData) {
    const container = document.getElementById('traceFlow');
    if (!traceData || traceData.length === 0) {
      container.innerHTML = '<div style="color:#6b7280;font-size:12px;text-align:center;padding:20px;">暂无信令回溯数据</div>';
      return;
    }
    const neList = ['UE', 'Source gNB', 'Target gNB', 'AMF', 'SMF'];
    const neIndex = ne => neList.indexOf(ne) >= 0 ? neList.indexOf(ne) : 0;
    const laneWidth = 100 / neList.length;

    // Build rows: each signal is a horizontal arrow between two lanes
    let rowsHtml = '';
    traceData.forEach((t, i) => {
      const fromIdx = neIndex(t.fromNe);
      const toIdx = neIndex(t.toNe);
      const isAbnormal = t.abnormal;
      const leftPct = Math.min(fromIdx, toIdx) * laneWidth + laneWidth * 0.5;
      const widthPct = Math.abs(toIdx - fromIdx) * laneWidth;
      const direction = toIdx > fromIdx ? 'right' : 'left';
      const arrowClass = isAbnormal ? 'sig-arrow abnormal' : 'sig-arrow';
      const labelClass = isAbnormal ? 'sig-label abnormal' : 'sig-label';

      rowsHtml += `
        <div class="sig-row" style="height:48px;position:relative;">
          <div class="${arrowClass}" style="left:${leftPct}%;width:${widthPct}%;top:50%;transform:translateY(-50%);">
            <div class="${labelClass}">${t.message}</div>
          </div>
          <div class="sig-time" style="position:absolute;left:4px;top:4px;font-size:10px;color:#64748b;">${t.time}</div>
          ${isAbnormal ? `<div class="sig-reason" style="position:absolute;right:4px;top:4px;font-size:10px;color:#ef4444;">${t.reason || '异常'}</div>` : ''}
        </div>
      `;
    });

    // Build lane headers
    const lanesHtml = neList.map((ne, i) => `
      <div class="sig-lane" style="left:${i * laneWidth}%;width:${laneWidth}%;">
        <div class="sig-lane-name">${ne}</div>
        <div class="sig-lane-line"></div>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="ladder-diagram">
        <div class="ladder-lanes">${lanesHtml}</div>
        <div class="ladder-rows">${rowsHtml}</div>
      </div>
    `;
  }

  // Modal handling
  let modalCharts = {};
  window.showAssuranceModal = function() {
    document.getElementById('assuranceModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
  };
  window.hideAssuranceModal = function() {
    document.getElementById('assuranceModal').style.display = 'none';
    document.body.style.overflow = '';
  };
  window.switchModalTab = function(tab) {
    document.querySelectorAll('.am-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.am-tab-content').forEach(c => c.classList.toggle('active', c.id === 'tab-' + tab));
    if (tab === 'metrics' && !modalCharts.rsrp) {
      initModalCharts();
    }
  };
  function initModalCharts() {
    const trend = (currentAssuranceData && currentAssuranceData.trend) || [];
    const mkChart = (id, name, threshold, color, key) => {
      const chart = echarts.init(document.getElementById(id));
      let data = [];
      if (trend.length > 0) {
        data = trend.map((t, i) => {
          const val = t[key];
          const abnormal = (threshold < 0 && val < threshold) || (threshold > 0 && val > threshold);
          return { value: val, abnormal };
        });
      } else {
        data = generateMetricData(threshold - 15, threshold + 25, threshold, 30);
      }
      const xData = data.map((_, i) => i);
      const seriesData = data.map(d => d.value);
      const abnormalPoints = data.map((d, i) => d.abnormal ? d.value : null);
      chart.setOption({
        tooltip: { trigger: 'axis', backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.08)', textStyle: { color: '#ffffff', fontSize: 11 } },
        grid: { left: 0, right: 8, top: 4, bottom: 0 },
        xAxis: { type: 'category', data: xData, show: false },
        yAxis: { type: 'value', show: false, min: Math.min(...seriesData) * 0.95, max: Math.max(...seriesData) * 1.05 },
        series: [
          { type: 'line', data: seriesData, smooth: true, symbol: 'none', lineStyle: { width: 1.5, color: color }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: color.replace(')', ',0.2)').replace('rgb', 'rgba') }, { offset: 1, color: color.replace(')', ',0)').replace('rgb', 'rgba') }]) } },
          { type: 'line', data: Array(data.length).fill(threshold), symbol: 'none', lineStyle: { width: 1, type: 'dashed', color: '#ef4444' } },
          { type: 'scatter', data: abnormalPoints, symbolSize: 5, itemStyle: { color: '#38bdf8' } }
        ]
      });
      return chart;
    };
    modalCharts.rsrp = mkChart('modalChartRSRP', 'RSRP', -105, '#3b82f6', 'rsrp');
    modalCharts.sinr = mkChart('modalChartSINR', 'SINR', 3, '#10b981', 'sinr');
    modalCharts.delay = mkChart('modalChartDelay', 'Delay', 100, '#f59e0b', 'rlcDelay');
    window.addEventListener('resize', () => {
      Object.values(modalCharts).forEach(c => c && c.resize());
    });
  }

  function renderTraceAnalysis(wo, ad) {
    const summary = ad.summary || {};
    const tags = summary.tags || ['弱覆盖', 'RF覆盖弱覆盖', '5QI业务保障'];
    const evidence = summary.evidenceChain || ['RSRP均值低于门限', 'SINR均值偏低', '信令异常'];

    document.getElementById('abnormalExplain').innerHTML = tags.slice(0, 3).map(a => `<li>${a}</li>`).join('');
    document.getElementById('rootcauseExplain').innerHTML = evidence.slice(0, 3).map(r => `<li>${r}</li>`).join('');

    // Unified qualityEvents drive modal event list (same source as map markers & metric replay)
    const qe = ad.qualityEvents || [];
    const abnormalQe = qe.filter(e => e.abnormal);
    const count = abnormalQe.length;

    // Update metric tags with real count
    document.querySelectorAll('.mm-tag').forEach(el => {
      el.textContent = `异常事件 ${count}个`;
    });

    // Update event list title
    const listTitle = document.querySelector('.modal-event-title');
    if (listTitle) listTitle.textContent = `关联事件列表（${count}）`;

    // Render event table rows from unified source
    const tbody = document.querySelector('.modal-event-table tbody');
    if (tbody) {
      if (count === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#6b7280;">暂无异常事件</td></tr>';
      } else {
        tbody.innerHTML = abnormalQe.map(ev => `
          <tr>
            <td>${ev.time}</td>
            <td>${ev.type}</td>
            <td>${ev.cell}</td>
            <td><span class="map-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#38bdf8;margin-right:4px;"></span>${ev.eventId}</td>
          </tr>
        `).join('');
      }
    }

    // Update paging
    const paging = document.querySelector('.modal-event-paging');
    if (paging) paging.innerHTML = `共 ${count} 条 <span class="page-num active">1</span>`;
  }

  function renderCIOList(grid, wo) {
    const ad = DATA.assurance[wo.id] || {};
    const cioList = ad.cio || [];
    const mainCell = wo.mainCell || '5838088/1025';

    if (cioList.length === 0) {
      document.getElementById('cioList').innerHTML = `
        <div class="cio-item">
          <div class="cio-item-header">
            <span class="cio-item-title">邻区CIO复核</span>
            <button class="cio-interpret-btn">智能体解读</button>
          </div>
          <div class="cio-detail">小区 ${mainCell} 与目标小区之间CIO=-3dB，建议调整为-1dB以提升切换成功率。</div>
          <div class="cio-actions">
            <button class="cio-action-btn approve"><i class="fas fa-check"></i></button>
            <button class="cio-action-btn reject"><i class="fas fa-times"></i></button>
          </div>
        </div>
        <div class="cio-item">
          <div class="cio-item-header">
            <span class="cio-item-title">A3门限复核</span>
            <button class="cio-interpret-btn">智能体解读</button>
          </div>
          <div class="cio-detail">当前A3-offset=-2dB，事件触发过于频繁，建议收紧至-3dB减少乒乓切换。</div>
          <div class="cio-actions">
            <button class="cio-action-btn approve"><i class="fas fa-check"></i></button>
            <button class="cio-action-btn reject"><i class="fas fa-times"></i></button>
          </div>
        </div>`;
      return;
    }

    document.getElementById('cioList').innerHTML = cioList.map(item => `
      <div class="cio-item">
        <div class="cio-item-header">
          <span class="cio-item-title">${item.param || '参数复核'}</span>
          <button class="cio-interpret-btn">智能体解读</button>
        </div>
        <div class="cio-detail">小区 ${mainCell} ${item.mo || ''} 参数 ${item.param || ''} 当前值 ${item.current || '-'}，建议值 ${item.suggested || '-'}（置信度 ${Math.round((item.evidence || 0.8) * 100)}%）</div>
        <div class="cio-actions">
          <button class="cio-action-btn approve"><i class="fas fa-check"></i></button>
          <button class="cio-action-btn reject"><i class="fas fa-times"></i></button>
        </div>
      </div>
    `).join('');
  }

  function renderStrategyGrid(wo, grid, qk) {
    const stats = grid.stats[qk] || {};
    const ad = DATA.assurance[wo.id] || {};
    const strategies = ad.strategies || [];
    const guards = ad.guards || [];

    const items = [
      { label: '策略ID', value: `SB-RCA-${wo.id}` },
      { label: '生效时间段', value: '17:00-18:00' },
      { label: '当前5QI', value: '5QI=' + (qk.replace('qi','') || '8') },
      { label: '质差类型', value: wo.qualityType || '--' },
      { label: '保障业务', value: strategies[0] ? strategies[0].name : (wo.qualityType || '直播/游戏') },
      { label: '优先级', value: 'P1' }
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
