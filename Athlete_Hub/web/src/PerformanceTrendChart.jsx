import { Line } from 'react-chartjs-2';
import { useMemo, useRef, useEffect } from 'react';
import './PerformanceTrendChart.css';

function PerformanceTrendChart({ data, title = 'Performance Progress' }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      title: { 
        display: true, 
        text: title,
        font: { size: 16 }
      },
      legend: {
        display: true,
        position: 'top'
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const value = context.parsed.y;
            return value !== null ? `${context.dataset.label}: ${value}` : `${context.dataset.label}: No data`;
          }
        }
      }
    },
    scales: {
      y: { 
        beginAtZero: true,
        title: { display: true, text: 'Value' }
      },
      x: {
        title: { display: true, text: 'Training Sessions' }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index'
    }
  }), [title]);

  // Generate a stable key that only changes when actual data content changes
  const dataKey = useMemo(() => {
    if (!data || !data.labels?.length) return 'empty';
    const labelsHash = data.labels.join('|');
    const datasetsHash = data.datasets?.map(d => `${d.label}:${d.data.join(',')}`).join('|') || '';
    return `${labelsHash}#${datasetsHash}`;
  }, [data]);

  // Cleanup chart on unmount
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, []);

  if (!data || !data.labels || data.labels.length === 0) {
    return <div className="performance-trend-chart empty">No performance data available for the selected time range.</div>;
  }

  return (
    <div className="performance-trend-chart">
      <div className="chart-container" ref={canvasRef}>
        <Line
          key={dataKey}
          data={data}
          options={chartOptions}
          ref={(chart) => { chartRef.current = chart; }}
        />
      </div>
    </div>
  );
}

export default PerformanceTrendChart;