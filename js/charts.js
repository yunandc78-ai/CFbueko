/**
 * CHARTS ENGINE MODULE - Bolu Bu Eko Cashflow
 * Pure Vanilla HTML5 Canvas charts without any external dependencies.
 * Supports High-DPI (Retina) rendering, responsive resize, smooth styling, and dark mode.
 */

class BakeryCharts {
  static getThemeColors() {
    const isDark = document.body.classList.contains('dark-theme');
    return {
      textColor: isDark ? '#E2D9D2' : '#4A3B32',
      gridColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(139, 69, 19, 0.08)',
      incomeBar: '#2E7D32',
      incomeSoft: '#81C784',
      expenseBar: '#C62828',
      expenseSoft: '#E57373',
      profitLine: '#1976D2',
      cardBg: isDark ? '#26211F' : '#FFFFFF',
      doughnutColors: [
        '#8B4513', '#D2691E', '#CD853F', '#E85A88', '#2E7D32',
        '#1976D2', '#F4A460', '#BC8F8F', '#9C27B0', '#009688', '#FF9800'
      ]
    };
  }

  // Setup canvas for crisp rendering on HiDPI/Retina screens
  static setupCanvas(canvas) {
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    const displayWidth = rect.width > 0 ? rect.width : (canvas.clientWidth || 600);
    const displayHeight = rect.height > 0 ? rect.height : (canvas.clientHeight || 300);

    canvas.width = Math.round(displayWidth * dpr);
    canvas.height = Math.round(displayHeight * dpr);

    ctx.resetTransform?.();
    ctx.scale(dpr, dpr);

    return { ctx, width: displayWidth, height: displayHeight, dpr };
  }

  // Format short number for Y-axis (e.g. 1.5jt, 500rb)
  static formatShortNumber(num) {
    if (num >= 1000000) {
      const jt = (num / 1000000).toFixed(1).replace('.0', '');
      return `${jt} jt`;
    }
    if (num >= 1000) {
      const rb = (num / 1000).toFixed(0);
      return `${rb} rb`;
    }
    return num.toString();
  }

  /**
   * 1. Cashflow Grouped Bar Chart (Income vs Expense)
   */
  static renderCashflowBarChart(canvasId, monthlyData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const setup = this.setupCanvas(canvas);
    if (!setup) return;
    const { ctx, width, height } = setup;
    const colors = this.getThemeColors();

    ctx.clearRect(0, 0, width, height);

    if (!monthlyData || monthlyData.length === 0) {
      ctx.fillStyle = colors.textColor;
      ctx.font = '14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Belum ada data transaksi bulanan', width / 2, height / 2);
      return;
    }

    // Chart paddings
    const padding = { top: 40, right: 30, bottom: 50, left: 65 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Find max value
    const maxVal = Math.max(
      ...monthlyData.map(d => Math.max(d.income, d.expense)),
      1000000 // minimum scale 1jt
    );

    // Nice round number for Y axis
    const niceMax = Math.ceil(maxVal * 1.15 / 500000) * 500000;
    const gridLines = 4;

    // Draw horizontal grid lines & Y labels
    ctx.lineWidth = 1;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = '11px system-ui, sans-serif';

    for (let i = 0; i <= gridLines; i++) {
      const yVal = (niceMax / gridLines) * i;
      const yPos = padding.top + chartHeight - (i / gridLines) * chartHeight;

      // Grid line
      ctx.strokeStyle = colors.gridColor;
      ctx.beginPath();
      ctx.moveTo(padding.left, yPos);
      ctx.lineTo(width - padding.right, yPos);
      ctx.stroke();

      // Label
      ctx.fillStyle = colors.textColor;
      ctx.fillText(`Rp ${this.formatShortNumber(yVal)}`, padding.left - 10, yPos);
    }

    // Draw Legends
    const legendY = 16;
    const legendItems = [
      { label: 'Pemasukan', color: colors.incomeBar },
      { label: 'Pengeluaran', color: colors.expenseBar }
    ];

    let legendX = width - padding.right - 180;
    legendItems.forEach(item => {
      // Color box
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(legendX, legendY - 6, 12, 12, 3) : ctx.rect(legendX, legendY - 6, 12, 12);
      ctx.fill();

      // Text
      ctx.fillStyle = colors.textColor;
      ctx.textAlign = 'left';
      ctx.font = '500 12px system-ui, sans-serif';
      ctx.fillText(item.label, legendX + 18, legendY);
      legendX += 95;
    });

    // Bars
    const barGroupWidth = chartWidth / monthlyData.length;
    const barWidth = Math.max(8, Math.min(26, (barGroupWidth - 16) / 2));

    monthlyData.forEach((data, index) => {
      const groupCenterX = padding.left + index * barGroupWidth + barGroupWidth / 2;

      // Income Bar (Left)
      const incomeHeight = (data.income / niceMax) * chartHeight;
      const incomeX = groupCenterX - barWidth - 3;
      const incomeY = padding.top + chartHeight - incomeHeight;

      if (incomeHeight > 0) {
        ctx.fillStyle = colors.incomeBar;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(incomeX, incomeY, barWidth, incomeHeight, [4, 4, 0, 0]);
        } else {
          ctx.rect(incomeX, incomeY, barWidth, incomeHeight);
        }
        ctx.fill();

        // Income value label on top
        if (incomeHeight > 18) {
          ctx.fillStyle = colors.incomeBar;
          ctx.font = '600 10px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(this.formatShortNumber(data.income), incomeX + barWidth / 2, incomeY - 6);
        }
      }

      // Expense Bar (Right)
      const expenseHeight = (data.expense / niceMax) * chartHeight;
      const expenseX = groupCenterX + 3;
      const expenseY = padding.top + chartHeight - expenseHeight;

      if (expenseHeight > 0) {
        ctx.fillStyle = colors.expenseBar;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(expenseX, expenseY, barWidth, expenseHeight, [4, 4, 0, 0]);
        } else {
          ctx.rect(expenseX, expenseY, barWidth, expenseHeight);
        }
        ctx.fill();

        // Expense value label on top
        if (expenseHeight > 18) {
          ctx.fillStyle = colors.expenseBar;
          ctx.font = '600 10px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(this.formatShortNumber(data.expense), expenseX + barWidth / 2, expenseY - 6);
        }
      }

      // Month Label on X-axis
      ctx.fillStyle = colors.textColor;
      ctx.textAlign = 'center';
      ctx.font = '500 11px system-ui, sans-serif';
      ctx.fillText(data.label, groupCenterX, height - padding.bottom + 20);

      // Profit badge indicator below month
      const net = data.income - data.expense;
      const profitText = (net >= 0 ? '+' : '') + this.formatShortNumber(net);
      ctx.fillStyle = net >= 0 ? colors.incomeBar : colors.expenseBar;
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.fillText(profitText, groupCenterX, height - padding.bottom + 36);
    });

    // Base axis line
    ctx.strokeStyle = colors.gridColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + chartHeight);
    ctx.lineTo(width - padding.right, padding.top + chartHeight);
    ctx.stroke();
  }

  /**
   * 2. Expense Category Donut / Pie Chart
   */
  static renderExpenseDonutChart(canvasId, legendContainerId, categoryData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const setup = this.setupCanvas(canvas);
    if (!setup) return;
    const { ctx, width, height } = setup;
    const colors = this.getThemeColors();

    ctx.clearRect(0, 0, width, height);

    const { list, total } = categoryData;
    const legendEl = document.getElementById(legendContainerId);

    if (!list || list.length === 0 || total === 0) {
      ctx.fillStyle = colors.textColor;
      ctx.font = '14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Belum ada data pengeluaran', width / 2, height / 2);
      if (legendEl) legendEl.innerHTML = '<p class="text-muted text-center py-3">Tidak ada data</p>';
      return;
    }

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 20;
    const innerRadius = radius * 0.58; // Donut hole

    let startAngle = -Math.PI / 2;

    list.forEach((item, index) => {
      const sliceAngle = (item.amount / total) * 2 * Math.PI;
      const endAngle = startAngle + sliceAngle;
      const sliceColor = colors.doughnutColors[index % colors.doughnutColors.length];

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = sliceColor;
      ctx.fill();

      // Border between slices
      ctx.strokeStyle = colors.cardBg;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      startAngle = endAngle;
    });

    // Center Summary in Donut
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = colors.textColor;
    ctx.font = '500 11px system-ui, sans-serif';
    ctx.fillText('Total Beban', centerX, centerY - 10);
    ctx.fillStyle = colors.expenseBar;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(Utils.formatRupiah(total), centerX, centerY + 10);

    // Build Legend in HTML container
    if (legendEl) {
      let legendHtml = '<div class="donut-legend-grid">';
      list.forEach((item, index) => {
        const sliceColor = colors.doughnutColors[index % colors.doughnutColors.length];
        legendHtml += `
          <div class="donut-legend-item">
            <span class="donut-legend-dot" style="background-color: ${sliceColor}"></span>
            <div class="donut-legend-info">
              <span class="donut-legend-cat">${item.category}</span>
              <span class="donut-legend-amount">${Utils.formatRupiah(item.amount)} <small>(${item.percentage}%)</small></span>
            </div>
          </div>
        `;
      });
      legendHtml += '</div>';
      legendEl.innerHTML = legendHtml;
    }
  }

  /**
   * 3. Comparison Line Chart (Monthly Trends for Reports)
   */
  static renderComparisonLineChart(canvasId, monthlyData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const setup = this.setupCanvas(canvas);
    if (!setup) return;
    const { ctx, width, height } = setup;
    const colors = this.getThemeColors();

    ctx.clearRect(0, 0, width, height);

    if (!monthlyData || monthlyData.length === 0) {
      ctx.fillStyle = colors.textColor;
      ctx.font = '14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Belum ada data perbandingan', width / 2, height / 2);
      return;
    }

    const padding = { top: 40, right: 30, bottom: 45, left: 65 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const maxVal = Math.max(
      ...monthlyData.map(d => Math.max(d.income, d.expense, Math.abs(d.profit))),
      1000000
    );
    const niceMax = Math.ceil(maxVal * 1.2 / 500000) * 500000;
    const gridLines = 4;

    // Draw Grid & Y Labels
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = '11px system-ui, sans-serif';

    for (let i = 0; i <= gridLines; i++) {
      const yVal = (niceMax / gridLines) * i;
      const yPos = padding.top + chartHeight - (i / gridLines) * chartHeight;

      ctx.strokeStyle = colors.gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding.left, yPos);
      ctx.lineTo(width - padding.right, yPos);
      ctx.stroke();

      ctx.fillStyle = colors.textColor;
      ctx.fillText(`Rp ${this.formatShortNumber(yVal)}`, padding.left - 10, yPos);
    }

    // Legends
    const legends = [
      { label: 'Pemasukan', color: colors.incomeBar },
      { label: 'Pengeluaran', color: colors.expenseBar },
      { label: 'Laba Bersih', color: colors.profitLine }
    ];
    let legendX = width - padding.right - 270;
    legends.forEach(item => {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(legendX + 6, 16, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = colors.textColor;
      ctx.textAlign = 'left';
      ctx.font = '500 12px system-ui, sans-serif';
      ctx.fillText(item.label, legendX + 16, 16);
      legendX += 95;
    });

    const stepX = chartWidth / (monthlyData.length - 1 || 1);

    // Helper to draw a line series
    const drawSeries = (key, color, isDashed = false) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.setLineDash(isDashed ? [5, 4] : []);
      ctx.beginPath();

      monthlyData.forEach((d, idx) => {
        const x = padding.left + idx * stepX;
        const val = Math.max(0, d[key]);
        const y = padding.top + chartHeight - (val / niceMax) * chartHeight;

        if (idx === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw dots
      monthlyData.forEach((d, idx) => {
        const x = padding.left + idx * stepX;
        const val = Math.max(0, d[key]);
        const y = padding.top + chartHeight - (val / niceMax) * chartHeight;

        ctx.fillStyle = colors.cardBg;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.stroke();
      });
    };

    // Draw Profit Line
    drawSeries('profit', colors.profitLine, true);
    // Draw Expense Line
    drawSeries('expense', colors.expenseBar);
    // Draw Income Line
    drawSeries('income', colors.incomeBar);

    // X-axis month labels
    monthlyData.forEach((d, idx) => {
      const x = padding.left + idx * stepX;
      ctx.fillStyle = colors.textColor;
      ctx.textAlign = 'center';
      ctx.font = '500 11px system-ui, sans-serif';
      ctx.fillText(d.label, x, height - padding.bottom + 22);
    });
  }
}

window.BakeryCharts = BakeryCharts;
