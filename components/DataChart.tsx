'use client';

import React, { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

interface DataChartProps {
  data: any[];
  columns: string[];
  type: 'bar' | 'pie' | 'line';
}

const DataChart: React.FC<DataChartProps> = ({ data, columns, type }) => {
  const [chartData, setChartData] = useState<any>(null);

  useEffect(() => {
    if (!data.length || !columns.length) return;

    // For simplicity, use the first column as labels and second column as data
    const labelColumn = columns[0];
    const dataColumn = columns.length > 1 ? columns[1] : columns[0];

    // Extract labels and data values
    const labels = data.map(item => String(item[labelColumn]));
    const values = data.map(item => Number(item[dataColumn]) || 0);

    // Generate random colors for the chart
    const backgroundColors = data.map(() => 
      `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.6)`
    );

    const chartConfig = {
      labels,
      datasets: [
        {
          label: dataColumn,
          data: values,
          backgroundColor: backgroundColors,
          borderColor: backgroundColors.map(color => color.replace('0.6', '1')),
          borderWidth: 1,
        },
      ],
    };

    setChartData(chartConfig);
  }, [data, columns, type]);

  if (!chartData) {
    return (
      <div className="flex justify-center items-center h-64 bg-gray-50">
        <p className="text-gray-500">No data to display</p>
      </div>
    );
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: `${columns.length > 1 ? columns[1] : columns[0]} by ${columns[0]}`,
      },
    },
  };

  return (
    <div className="h-80 p-4">
      {type === 'bar' && <Bar data={chartData} options={options} />}
      {type === 'pie' && <Pie data={chartData} options={options} />}
      {type === 'line' && <Line data={chartData} options={options} />}
    </div>
  );
};

export default DataChart;
