import { Line } from 'react-chartjs-2';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { useMemo, useRef, useEffect } from 'react';
import './PerformanceTrendChart.css';

ChartJS.register(CategoryScale, Filler, Legend, LineElement, LinearScale, PointElement, Title, Tooltip);

// Distinct, readable series colours; the API's colour is kept unless it is its neutral grey fallback.
const SERIES_COLORS = ['#b3172b', '#1d4ed8', '#0f766e', '#c2410c', '#6d28d9', '#a16207', '#be185d']
const API_FALLBACK_COLOR = 'rgb(201, 203, 207)'

function withSeriesStyle(data) {
  return {
    ...data,
    datasets: (data.datasets || []).map((dataset, index) => {
      const color = dataset.borderColor && dataset.borderColor !== API_FALLBACK_COLOR ? dataset.borderColor : SERIES_COLORS[index % SERIES_COLORS.length]
      return { ...dataset, borderColor: color, backgroundColor: color, pointRadius: 5, pointHoverRadius: 7, borderWidth: 2.5, spanGaps: true }
    }),
  }
}

function PerformanceTrendChart({ data, title = 'Performance Progress' }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      title: {
        display: Boolean(title),
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
    return <p className="muted">No performance data available for the selected time range.</p>;
  }

  return (
    <div className="performance-trend-chart">
      <div className="chart-container" ref={canvasRef}>
        <Line
          key={dataKey}
          data={withSeriesStyle(data)}
          options={chartOptions}
          ref={(chart) => { chartRef.current = chart; }}
        />
      </div>
    </div>
  );
}

export default PerformanceTrendChart;