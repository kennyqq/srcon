// SRCON Demo - Common Utilities

const COMMON = {
  // Format large numbers with commas
  formatNumber(num) {
    if (num === null || num === undefined) return '--';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },

  // Get color by quality rate
  getColorByRate(rate) {
    if (rate <= 2) return '#22c55e';
    if (rate <= 4) return '#84cc16';
    if (rate <= 6) return '#eab308';
    if (rate <= 8) return '#f97316';
    return '#dc2626';
  },

  // Parse URL parameters
  getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    for (const [key, value] of params.entries()) {
      result[key] = value;
    }
    return result;
  },

  // ECharts dark theme colors
  chartColors: [
    '#3b82f6', '#06b6d4', '#10b981', '#8b5cf6', 
    '#f97316', '#ec4899', '#eab308', '#ef4444', '#6366f1'
  ],

  // Create donut chart option
  createDonutOption(title, data, colors) {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#f1f5f9', fontSize: 12 },
        formatter: (params) => {
          return `${params.name}<br/><span style="color:${params.color}">●</span> ${params.value}% (${params.name})`;
        }
      },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center',
        textStyle: { color: '#94a3b8', fontSize: 11 },
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 8,
        formatter: (name) => {
          const item = data.find(d => d.name === name);
          const shortName = name.length > 10 ? name.substring(0, 10) + '...' : name;
          return `${shortName}  ${item ? item.value : 0}%`;
        }
      },
      series: [{
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#1e293b',
          borderWidth: 2
        },
        label: {
          show: false
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 13,
            fontWeight: 'bold',
            color: '#f1f5f9'
          }
        },
        labelLine: { show: false },
        data: data.map((item, idx) => ({
          ...item,
          itemStyle: { color: colors ? colors[idx % colors.length] : this.chartColors[idx % this.chartColors.length] }
        }))
      }]
    };
  },

  // Create bar chart option
  createBarOption(title, data, color) {
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#f1f5f9', fontSize: 12 }
      },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
      xAxis: {
        type: 'category',
        data: data.map(d => d.name),
        axisLine: { lineStyle: { color: '#334155' } },
        axisLabel: { color: '#94a3b8', fontSize: 11, rotate: 30 }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#334155', type: 'dashed' } },
        axisLabel: { color: '#94a3b8', fontSize: 11 }
      },
      series: [{
        type: 'bar',
        data: data.map(d => d.value),
        itemStyle: {
          color: color || '#3b82f6',
          borderRadius: [4, 4, 0, 0]
        },
        barWidth: '50%'
      }]
    };
  },

  // Create line chart option
  createLineOption(seriesData, colors) {
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#f1f5f9', fontSize: 12 }
      },
      legend: {
        data: seriesData.map(s => s.name),
        textStyle: { color: '#94a3b8', fontSize: 11 },
        top: 0
      },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: seriesData[0]?.data.map((_, i) => `${i}:00`) || [],
        axisLine: { lineStyle: { color: '#334155' } },
        axisLabel: { color: '#94a3b8', fontSize: 11 }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#334155', type: 'dashed' } },
        axisLabel: { color: '#94a3b8', fontSize: 11 }
      },
      series: seriesData.map((s, idx) => ({
        name: s.name,
        type: 'line',
        smooth: true,
        data: s.data,
        lineStyle: { width: 2 },
        itemStyle: { color: colors[idx % colors.length] },
        areaStyle: {
          opacity: 0.1,
          color: colors[idx % colors.length]
        }
      }))
    };
  }
};
