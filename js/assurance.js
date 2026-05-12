// SRCON Demo - Assurance Page Logic

let charts = {};

// ============================================================
// Initialization
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  const params = COMMON.getUrlParams();
  const caseId = params.caseId;
  
  if (!caseId || !SRCON_DATA.detailData[caseId]) {
    document.querySelector('.assurance-content').innerHTML = `
      <div style="text-align:center;padding:80px 0;color:var(--text-secondary);">
        <i class="fas fa-exclamation-circle" style="font-size:48px;margin-bottom:16px;display:block;"></i>
        <p>未找到工单数据</p>
        <a href="index.html" class="btn btn-primary" style="margin-top:16px;display:inline-block;text-decoration:none;">返回首页</a>
      </div>
    `;
    return;
  }
  
  const data = SRCON_DATA.detailData[caseId];
  renderPage(data);
  initCharts(data);
  
  window.addEventListener('resize', () => {
    Object.values(charts).forEach(c => c && c.resize());
  });
});

// ============================================================
// Render Page
// ============================================================
function renderPage(data) {
  const order = data.order;
  const grid = data.grid;
  
  // Title
  document.getElementById('woTitle').textContent = `${grid.name} 区域质差事件识别`;
  document.title = `质差分析 - ${order.id}`;
  
  // Summary
  renderSummary(data);
  
  // Problem Analysis
  renderProblem(data);
  
  // Abnormal Pattern Top3
  renderAbnormalTop3(data);
  
  // Root Cause
  renderRootcause(data);
  
  // Policy
  renderPolicy(data);
}

// ============================================================
// Summary
// ============================================================
function renderSummary(data) {
  const order = data.order;
  const grid = data.grid;
  const problem = data.problem;
  
  document.getElementById('summaryGrid').innerHTML = `
    <div class="summary-item">
      <div class="label">工单ID</div>
      <div class="value" style="font-size:14px;">${order.id}</div>
    </div>
    <div class="summary-item">
      <div class="label">主服务小区</div>
      <div class="value" style="font-size:14px;">${order.mainCell}</div>
    </div>
    <div class="summary-item">
      <div class="label">特征群组</div>
      <div class="value">${order.group.toUpperCase().replace('QI', 'QI=')}</div>
    </div>
    <div class="summary-item">
      <div class="label">AOI网格</div>
      <div class="value" style="font-size:14px;">${grid.name}</div>
    </div>
    <div class="summary-item">
      <div class="label">质差事件数</div>
      <div class="value" style="color:var(--accent-red);">${COMMON.formatNumber(problem.qualityEvents)}</div>
    </div>
    <div class="summary-item">
      <div class="label">质差比例</div>
      <div class="value" style="color:var(--accent-red);">${problem.rate}%</div>
    </div>
  `;
  
  document.getElementById('summaryText').textContent = data.summary.text;
}

// ============================================================
// Problem Analysis Table
// ============================================================
function renderProblem(data) {
  const p = data.problem;
  const rows = [
    { label: '通讯事件数', value: COMMON.formatNumber(p.totalEvents), desc: '当前工单关联事件' },
    { label: '质差事件数', value: COMMON.formatNumber(p.qualityEvents), desc: '异常事件' },
    { label: '质差比例', value: p.rate + '%', desc: '质差事件 / 通讯事件' },
    { label: '弱覆盖事件', value: COMMON.formatNumber(p.weakCoverage), desc: 'RSRP 低于阈值' },
    { label: '低SINR事件', value: COMMON.formatNumber(p.lowSinr), desc: '干扰或信号质量问题' },
    { label: '切换失败事件', value: COMMON.formatNumber(p.handoverFail), desc: '信令过程异常' },
    { label: '掉线事件', value: COMMON.formatNumber(p.dropLine), desc: '连接异常释放' },
    { label: '时延异常事件', value: COMMON.formatNumber(p.delayAbnormal), desc: '时延超过门限' }
  ];
  
  document.getElementById('problemTableBody').innerHTML = rows.map(r => `
    <tr>
      <td>${r.label}</td>
      <td style="font-weight:600;">${r.value}</td>
      <td style="color:var(--text-secondary);font-size:12px;">${r.desc}</td>
    </tr>
  `).join('');
}

// ============================================================
// Charts
// ============================================================
function initCharts(data) {
  // Abnormal bar chart
  charts.abnormalBar = echarts.init(document.getElementById('chartAbnormalBar'));
  const abnormalData = Object.entries(data.abnormal.distribution)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  
  charts.abnormalBar.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      textStyle: { color: '#f1f5f9', fontSize: 12 },
      formatter: '{b}: {c}%'
    },
    grid: { left: '3%', right: '8%', bottom: '3%', top: '5%', containLabel: true },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#334155', type: 'dashed' } },
      axisLabel: { color: '#94a3b8', fontSize: 11, formatter: '{value}%' }
    },
    yAxis: {
      type: 'category',
      data: abnormalData.map(d => d.name.length > 8 ? d.name.substring(0, 8) + '...' : d.name),
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#94a3b8', fontSize: 11 }
    },
    series: [{
      type: 'bar',
      data: abnormalData.map(d => d.value),
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: '#3b82f6' },
          { offset: 1, color: '#06b6d4' }
        ]),
        borderRadius: [0, 4, 4, 0]
      },
      barWidth: '60%',
      label: {
        show: true,
        position: 'right',
        formatter: '{c}%',
        color: '#94a3b8',
        fontSize: 11
      }
    }]
  });
  
  // Metric replay line chart
  charts.metricReplay = echarts.init(document.getElementById('chartMetricReplay'));
  const hours = data.abnormal.rsrpCurve.map(d => d.hour + ':00');
  
  charts.metricReplay.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      textStyle: { color: '#f1f5f9', fontSize: 12 }
    },
    legend: {
      data: ['RSRP (dBm)', 'SINR (dB)', 'RLC时延 (ms)'],
      textStyle: { color: '#94a3b8', fontSize: 11 },
      top: 0
    },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '12%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: hours,
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#94a3b8', fontSize: 10 }
    },
    yAxis: [
      {
        type: 'value',
        name: 'RSRP/SINR',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#334155', type: 'dashed' } },
        axisLabel: { color: '#94a3b8', fontSize: 10 }
      },
      {
        type: 'value',
        name: '时延',
        axisLine: { show: false },
        splitLine: { show: false },
        axisLabel: { color: '#94a3b8', fontSize: 10 }
      }
    ],
    series: [
      {
        name: 'RSRP (dBm)',
        type: 'line',
        smooth: true,
        data: data.abnormal.rsrpCurve.map(d => d.value),
        lineStyle: { width: 2, color: '#3b82f6' },
        itemStyle: { color: '#3b82f6' },
        symbol: 'none',
        markLine: {
          silent: true,
          lineStyle: { color: '#ef4444', type: 'dashed' },
          data: [{ yAxis: -110 }]
        }
      },
      {
        name: 'SINR (dB)',
        type: 'line',
        smooth: true,
        data: data.abnormal.sinrCurve.map(d => d.value),
        lineStyle: { width: 2, color: '#10b981' },
        itemStyle: { color: '#10b981' },
        symbol: 'none'
      },
      {
        name: 'RLC时延 (ms)',
        type: 'line',
        smooth: true,
        yAxisIndex: 1,
        data: data.abnormal.delayCurve.map(d => d.value),
        lineStyle: { width: 2, color: '#f97316' },
        itemStyle: { color: '#f97316' },
        symbol: 'none'
      }
    ]
  });
  
  // Root cause bar chart
  charts.rootcauseBar = echarts.init(document.getElementById('chartRootcauseBar'));
  const rcData = Object.entries(data.rootcause.distribution)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  
  charts.rootcauseBar.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      textStyle: { color: '#f1f5f9', fontSize: 12 },
      formatter: '{b}: {c}%'
    },
    grid: { left: '3%', right: '8%', bottom: '3%', top: '5%', containLabel: true },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#334155', type: 'dashed' } },
      axisLabel: { color: '#94a3b8', fontSize: 11, formatter: '{value}%' }
    },
    yAxis: {
      type: 'category',
      data: rcData.map(d => d.name.length > 12 ? d.name.substring(0, 12) + '...' : d.name),
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#94a3b8', fontSize: 10 }
    },
    series: [{
      type: 'bar',
      data: rcData.map(d => d.value),
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: '#8b5cf6' },
          { offset: 1, color: '#ec4899' }
        ]),
        borderRadius: [0, 4, 4, 0]
      },
      barWidth: '55%',
      label: {
        show: true,
        position: 'right',
        formatter: '{c}%',
        color: '#94a3b8',
        fontSize: 11
      }
    }]
  });
}

// ============================================================
// Abnormal Top3
// ============================================================
function renderAbnormalTop3(data) {
  const top3 = data.abnormal.top3;
  document.getElementById('abnormalTop3').innerHTML = top3.map((item, idx) => `
    <div class="top3-item">
      <span class="rank">${idx + 1}</span>
      <span class="name">${item.name}</span>
      <div class="desc">${item.desc}</div>
    </div>
  `).join('');
}

// ============================================================
// Root Cause
// ============================================================
function renderRootcause(data) {
  document.getElementById('rootcauseEvidence').innerHTML = `
    <p><strong>TOP1 根因：</strong>${data.rootcause.topCause}</p>
    <p style="margin-top:8px;">${data.rootcause.evidence}</p>
  `;
  
  document.getElementById('affectedCells').innerHTML = `
    <h4><i class="fas fa-broadcast-tower" style="color:var(--accent-blue);margin-right:6px;"></i>涉及小区</h4>
    <div class="cell-tags">
      ${data.rootcause.affectedCells.map(c => `<span class="cell-tag">${c}</span>`).join('')}
    </div>
  `;
}

// ============================================================
// Policy
// ============================================================
function renderPolicy(data) {
  // Bind action buttons
  document.querySelectorAll('.audit-actions .btn, .header-actions .btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.textContent.trim();
      if (text.includes('审核通过')) {
        alert('策略已标记为审核通过，将进入脚本生成流程');
      } else if (text.includes('审核不通过')) {
        alert('策略已标记为审核不通过，请填写原因');
      } else if (text.includes('加入脚本草案')) {
        alert('策略已加入脚本草案队列');
      } else if (text.includes('查看回滚条件')) {
        alert('回滚条件：参数调整后若质差率未下降或网络KPI恶化超过5%，则自动回滚至调整前状态');
      } else {
        alert('功能开发中');
      }
    });
  });
  
  const policies = data.policies;
  
  document.getElementById('policyIntro').innerHTML = `
    <p><strong>核心措施：</strong>共涉及 ${policies.length} 条策略草案，主要调整 ${[...new Set(policies.map(p => p['优化类型']))].join('、')} 等参数。</p>
    <p style="margin-top:6px;">策略基于MR数据和RCA分析生成，参数调整范围在工程安全阈值内，具备回滚条件。所有策略需经专家复核后进入脚本生成流程，<strong style="color:var(--accent-red);">不涉及自动现网下发</strong>。</p>
  `;
  
  document.getElementById('policyTableBody').innerHTML = policies.map(p => `
    <tr>
      <td><span style="color:var(--accent-blue);font-weight:500;">${p['优化类型']}</span></td>
      <td>${p['gNBId']}</td>
      <td title="${p['CellName']}">${p['CellName']}</td>
      <td>${p['MO'] || '-'}</td>
      <td>${p['Parameter Name']}</td>
      <td class="val-current">${p['Current Value']}</td>
      <td class="val-suggested">${p['Suggested Value']}</td>
    </tr>
  `).join('');
}
