'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Chart } from 'react-google-charts';
import { Button } from './ui/button';
import { ChevronDown } from 'lucide-react';

// Define available chart types
type ChartType = 'ColumnChart' | 'BarChart' | 'LineChart' | 'AreaChart' | 'PieChart' | 'DonutChart' | 'ScatterChart' | 'ComboChart';

// Extend the window interface for our chart storage
declare global {
  interface Window {
    __chartInstances?: Array<{
      chart: any;
      getImageURI: (() => string | null) | null;
    }>;
  }
}

interface ChartTextStyle {
  fontSize?: number;
  bold?: boolean;
  color?: string;
}

interface GridlineOptions {
  color?: string;
  count?: number;
}

interface ChartAxisStyle {
  title?: string;
  titleTextStyle?: ChartTextStyle;
  textStyle?: ChartTextStyle;
  slantedText?: boolean;
  slantedTextAngle?: number;
  maxTextLines?: number;
  gridlines?: GridlineOptions;
  minorGridlines?: GridlineOptions;
  viewWindow?: {
    min?: number;
    max?: number;
  };
}

interface ChartOptions {
  width: number;
  height: number;
  title?: string;
  backgroundColor: string;
  fontSize?: number;
  lineWidth?: number;
  chartArea?: {
    width?: string;
    height?: string;
    left?: string;
    right?: string;
    top?: string;
    bottom?: string;
  };
  animation?: {
    startup?: boolean;
    duration?: number;
    easing?: string;
  };
  legend?: {
    position?: 'top' | 'bottom' | 'left' | 'right' | 'none';
    alignment?: 'start' | 'center' | 'end';
    textStyle?: ChartTextStyle;
  };
  tooltip?: {
    showColorCode?: boolean;
    textStyle?: ChartTextStyle;
    trigger?: 'none' | 'focus' | 'selection';
    isHtml?: boolean;
  };
  hAxis?: ChartAxisStyle;
  vAxis?: ChartAxisStyle;
  curveType?: 'none' | 'function';
  pointSize?: number;
  isStacked?: boolean;
  areaOpacity?: number;
  pieHole?: number;
  pieSliceText?: 'percentage' | 'value' | 'label';
  seriesType?: string;
  series?: Record<number, { type?: string }>;
  trendlines?: Record<number, object>;
  sliceVisibilityThreshold?: number;
  colors?: string[];
  bar?: {
    groupWidth?: string | number;
  };
}

interface TableData {
  [key: string]: string;
}

interface TableChartToggleProps {
  tableHtml: string;
  tableData: Array<Record<string, any>>;
  initialOptions?: ChartOptions;
  onChartStateChange?: (isChart: boolean) => void;
}

// A4 dimensions in pixels at 96 DPI
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;
const MARGIN_PX = 40;

// Calculate available space for chart
const AVAILABLE_WIDTH = A4_WIDTH_PX - (2 * MARGIN_PX);
const AVAILABLE_HEIGHT = Math.min(500, A4_HEIGHT_PX - (2 * MARGIN_PX));

// Default chart options with all customizations
const DEFAULT_CHART_OPTIONS: ChartOptions = {
  width: AVAILABLE_WIDTH,
  height: AVAILABLE_HEIGHT,
  fontSize: 11,
  backgroundColor: 'white',
  chartArea: {
    left: '15%',    // Increased left margin
    top: '15%',     // Increased top margin
    right: '5%',
    bottom: '15%',  // Increased bottom margin
    width: '80%',   // Adjusted width to account for margins
    height: '70%'   // Adjusted height to account for margins
  },
  colors: ['#4285F4', '#DB4437', '#F4B400', '#0F9D58', '#AB47BC', '#00ACC1', '#FF7043', '#9E9E9E'],
  legend: {
    position: 'bottom',
    alignment: 'center',
    textStyle: {
      fontSize: 11,
      color: '#333333',
      bold: false
    }
  },
  tooltip: {
    showColorCode: true,
    textStyle: {
      fontSize: 11,
      color: '#333333'
    }
  },
  hAxis: {
    textStyle: {
      fontSize: 11,
      color: '#333333'
    },
    titleTextStyle: {
      fontSize: 12,
      color: '#333333',
      bold: true
    },
    gridlines: {
      count: 5,
      color: '#E0E0E0'
    },
    minorGridlines: {
      count: 0
    }
  },
  vAxis: {
    textStyle: {
      fontSize: 11,
      color: '#333333'
    },
    titleTextStyle: {
      fontSize: 12,
      color: '#333333',
      bold: true
    },
    gridlines: {
      count: 5,
      color: '#E0E0E0'
    },
    minorGridlines: {
      count: 0
    }
  }
};

// Chart type options
const chartTypeOptions = [
  { value: 'LineChart', label: 'Line Chart', icon: 'line' },
  { value: 'AreaChart', label: 'Area Chart', icon: 'area' },
  { value: 'BarChart', label: 'Bar Chart', icon: 'bar' },
  { value: 'ColumnChart', label: 'Column Chart', icon: 'column' },
  { value: 'PieChart', label: 'Pie Chart', icon: 'pie' },
  { value: 'DonutChart', label: 'Donut Chart', icon: 'donut' },
  { value: 'ScatterChart', label: 'Scatter Chart', icon: 'scatter' },
  { value: 'ComboChart', label: 'Combo Chart', icon: 'combo' }
];

const TableChartToggle: React.FC<TableChartToggleProps> = ({ 
  tableHtml, 
  tableData,
  initialOptions,
  onChartStateChange 
}) => {
  const [showChart, setShowChart] = useState(false);
  const [chartType, setChartType] = useState<ChartType>('ColumnChart');
  const [selectedLabelColumn, setSelectedLabelColumn] = useState<string>('');
  const [selectedValueColumns, setSelectedValueColumns] = useState<string[]>([]);
  const [chartOptions, setChartOptions] = useState<ChartOptions>(
    initialOptions || DEFAULT_CHART_OPTIONS
  );
  
  // Add reference to store the chart wrapper and chart instance
  const chartWrapperRef = useRef<any>(null);
  const chartInstanceRef = useRef<any>(null);

  // Initialize columns and selected columns
  useEffect(() => {
    if (tableData && tableData.length > 0) {
      const cols = Object.keys(tableData[0]);
      setSelectedLabelColumn(prev => prev || cols[0]);
      setSelectedValueColumns(prev => prev.length === 0 && cols.length > 1 ? [cols[1]] : prev);
    }
  }, [tableData]);

  // Update chart options whenever chart type or columns change
  useEffect(() => {
    if (chartType) {
      updateChartOptions(chartType);
    }
  }, [chartType, selectedLabelColumn, selectedValueColumns]);

  // Notify parent component of chart state changes
  useEffect(() => {
    if (onChartStateChange) {
      onChartStateChange(showChart);
    }
  }, [showChart, onChartStateChange]);

  // Get data for the chart
  const getChartData = () => {
    if (!tableData || !selectedLabelColumn || selectedValueColumns.length === 0) {
      return [['Label', 'Value'], ['No Data', 0]];
    }

    try {
      // Ensure all values are properly formatted
      const formatValue = (value: any) => {
        if (value === null || value === undefined) return 0;
        const num = Number(value);
        return isNaN(num) ? 0 : num;
      };

      // For pie and donut charts, we can only use one value column
      if (chartType === 'PieChart' || chartType === 'DonutChart') {
        const valueColumn = selectedValueColumns[0];
        if (!valueColumn) return [['Label', 'Value'], ['No Data', 0]];
        
        return [
          ['Label', 'Value'],
          ...tableData.map(row => [
            String(row[selectedLabelColumn] || ''),
            formatValue(row[valueColumn])
          ])
        ];
      }

      // For scatter charts, we need exactly two numeric columns
      if (chartType === 'ScatterChart') {
        if (selectedValueColumns.length < 2) {
          return [['X', 'Y'], [0, 0]];
        }
        return [
          [selectedValueColumns[0], selectedValueColumns[1]],
          ...tableData.map(row => [
            formatValue(row[selectedValueColumns[0]]),
            formatValue(row[selectedValueColumns[1]])
          ])
        ];
      }

      // For other chart types (ColumnChart, BarChart, LineChart, AreaChart, ComboChart)
      const headers = [selectedLabelColumn, ...selectedValueColumns];
      const rows = tableData.map(row => [
        String(row[selectedLabelColumn] || ''),
        ...selectedValueColumns.map(col => formatValue(row[col]))
      ]);

      // Ensure data is properly structured for Google Charts
      return [headers, ...rows];
    } catch (error) {
      console.error('Error processing chart data:', error);
      return [['Label', 'Value'], ['Error', 0]];
    }
  };

  // Update chart options based on type
  const updateChartOptions = (type: ChartType) => {
    const baseOptions = { ...DEFAULT_CHART_OPTIONS };
    
    // Common chart area settings for better centralization
    baseOptions.chartArea = {
      left: '10%',
      right: '5%',
      top: '10%',
      bottom: '15%',
      width: '85%',
      height: '75%'
    };

    // Ensure we have a valid width and height
    baseOptions.width = AVAILABLE_WIDTH;
    baseOptions.height = AVAILABLE_HEIGHT;
    
    switch (type) {
      case 'PieChart':
      case 'DonutChart':
        baseOptions.pieSliceText = 'percentage';
        baseOptions.pieHole = type === 'DonutChart' ? 0.4 : 0;
        baseOptions.legend = {
          position: 'right',
          alignment: 'center',
          textStyle: { fontSize: 11, color: '#333333' }
        };
        baseOptions.chartArea = {
          left: '5%',
          right: '20%',
          top: '5%',
          bottom: '5%',
          width: '75%',
          height: '90%'
        };
        break;
        
      case 'BarChart':
      case 'ColumnChart':
        baseOptions.bar = { groupWidth: '70%' };
        baseOptions.legend = {
          position: 'top',
          alignment: 'center',
          textStyle: { fontSize: 11, color: '#333333' }
        };
        baseOptions.hAxis = {
          ...baseOptions.hAxis,
          slantedText: type === 'ColumnChart',
          slantedTextAngle: type === 'ColumnChart' ? 45 : 0
        };
        baseOptions.vAxis = {
          ...baseOptions.vAxis,
          viewWindow: {
            min: 0
          }
        };
        break;
        
      case 'LineChart':
      case 'AreaChart':
        baseOptions.curveType = 'function';
        baseOptions.pointSize = 4;
        baseOptions.lineWidth = 2;
        baseOptions.areaOpacity = type === 'AreaChart' ? 0.2 : undefined;
        baseOptions.legend = {
          position: 'top',
          alignment: 'center'
        };
        baseOptions.vAxis = {
          ...baseOptions.vAxis,
          viewWindow: {
            min: 0
          }
        };
        break;
        
      case 'ScatterChart':
        baseOptions.pointSize = 6;
        baseOptions.legend = { position: 'none' };
        baseOptions.hAxis = {
          ...baseOptions.hAxis,
          title: selectedValueColumns[0],
          viewWindow: { min: 0 }
        };
        baseOptions.vAxis = {
          ...baseOptions.vAxis,
          title: selectedValueColumns[1],
          viewWindow: { min: 0 }
        };
        break;
        
      case 'ComboChart':
        baseOptions.seriesType = 'bars';
        baseOptions.series = {
          1: { type: 'line' }
        };
        baseOptions.legend = {
          position: 'top',
          alignment: 'center'
        };
        baseOptions.vAxis = {
          ...baseOptions.vAxis,
          viewWindow: {
            min: 0
          }
        };
        break;
    }
    
    setChartOptions(baseOptions);
  };

  // Handle chart type change
  const handleChartTypeChange = (newType: ChartType) => {
    setChartType(newType);
  };

  // Handle value column selection
  const handleValueColumnChange = (column: string, checked: boolean) => {
    if (checked) {
      setSelectedValueColumns(prev => [...prev, column]);
    } else {
      setSelectedValueColumns(prev => prev.filter(col => col !== column));
    }
  };

  // Add function to get chart image data
  const getChartImageURI = (): string | null => {
    try {
      if (chartInstanceRef.current) {
        return chartInstanceRef.current.getImageURI();
      }
      return null;
    } catch (error) {
      console.error('Error getting chart image URI:', error);
      return null;
    }
  };

  // Add to window object for debugging and external access
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).getChartImageURI = getChartImageURI;
      (window as any).chartInstance = chartInstanceRef;
    }
  }, []);

  return (
    <div className="my-4 border rounded-lg overflow-hidden">
      <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowChart(!showChart)}
            className="text-xs"
          >
            {showChart ? 'Show Table' : 'Show Chart'}
          </Button>
          
          {showChart && (
            <>
              <select
                value={chartType}
                onChange={(e) => handleChartTypeChange(e.target.value as ChartType)}
                className="text-xs border rounded px-2 py-1"
              >
                {chartTypeOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>

              <div className="flex flex-col">
                <label className="text-xs font-medium mb-1">Label Column:</label>
                <select
                  value={selectedLabelColumn}
                  onChange={(e) => setSelectedLabelColumn(e.target.value)}
                  className="text-xs border rounded px-2 py-1"
                >
                  {tableData && tableData.length > 0 && 
                    Object.keys(tableData[0]).map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))
                  }
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-medium mb-1">Value Columns:</label>
                <div className="flex flex-col space-y-1 max-h-32 overflow-y-auto border rounded p-2 bg-white">
                  {tableData && tableData.length > 0 && 
                    Object.keys(tableData[0])
                      .filter(col => col !== selectedLabelColumn)
                      .map(col => (
                        <label key={col} className="flex items-center text-xs">
                          <input
                            type="checkbox"
                            checked={selectedValueColumns.includes(col)}
                            onChange={(e) => handleValueColumnChange(col, e.target.checked)}
                            className="mr-1"
                          />
                          {col}
                        </label>
                      ))
                  }
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      
      <div className="p-4">
        {showChart ? (
          <div className="flex justify-center items-center" style={{ minHeight: '400px', width: '100%' }}>
            <Chart
              chartType={chartType}
              data={getChartData()}
              width={chartOptions.width}
              height={chartOptions.height}
              options={{
                ...chartOptions,
                // Remove width and height from options as they're passed as separate props
                width: undefined,
                height: undefined
              }}
              loader={<div>Loading Chart...</div>}
              // Add callback to store chart instance
              chartEvents={[
                {
                  eventName: 'ready',
                  callback: ({ chartWrapper }) => {
                    if (!chartWrapper) return;
                    
                    chartWrapperRef.current = chartWrapper;
                    try {
                      // Store the chart instance
                      const chart = chartWrapper.getChart();
                      chartInstanceRef.current = chart;
                      console.log('Chart instance stored:', !!chart);
                      
                      // Store chart in window for direct access by export functions
                      if (typeof window !== 'undefined') {
                        // Check if charts array exists, create if not
                        if (!window.__chartInstances) {
                          window.__chartInstances = [];
                        }
                        
                        // Push current chart to array
                        window.__chartInstances.push({
                          chart: chart,
                          getImageURI: chart && typeof chart.getImageURI === 'function' ? 
                            ((): string | null => {
                              try {
                                const uri = chart.getImageURI();
                                return typeof uri === 'string' ? uri : null;
                              } catch (e) {
                                return null;
                              }
                            }) : null
                        });
                        
                        console.log('Chart stored in window.__chartInstances array, index:', 
                                   window.__chartInstances.length - 1);
                      }
                      
                      // Debug: Print the DOM structure around the chart
                      console.log('Debug: Looking for chart container in DOM');
                      
                      // Find this chart container by walking up the DOM
                      setTimeout(() => {
                        try {
                          // Try to get the chart's container element
                          // Instead of using getContainer which doesn't exist, find it differently
                          const containerId = chartWrapper.getContainerId();
                          const container = document.getElementById(containerId);
                          
                          if (container) {
                            console.log('Found container element:', container);
                            
                            // Walk up the DOM to find parent with className='p-4' or with data-table-index
                            let element = container;
                            let foundTableContainer = false;
                            let maxTries = 10; // Prevent infinite loop
                            
                            while (element && maxTries > 0) {
                              console.log('Checking element:', element.tagName, 
                                         'classList:', element.className,
                                         'parent:', element.parentElement?.tagName);
                              
                              if (element.className.includes('p-4')) {
                                console.log('Found p-4 container:', element);
                                element.setAttribute('data-has-chart', 'true');
                                foundTableContainer = true;
                                break;
                              }
                              
                              if (element.hasAttribute('data-table-index')) {
                                console.log('Found element with data-table-index:', element);
                                element.setAttribute('data-has-chart', 'true');
                                foundTableContainer = true;
                                break;
                              }
                              
                              // Go up the DOM
                              if (element.parentElement) {
                                element = element.parentElement;
                              } else {
                                break;
                              }
                              
                              maxTries--;
                            }
                            
                            if (foundTableContainer) {
                              console.log('Successfully tagged container for export');
                              
                              // Store the chart instance on the element
                              (element as any).__chartInstance = chart;
                              (element as any).__chartIndex = window.__chartInstances?.length ? 
                                window.__chartInstances.length - 1 : 0;
                            } else {
                              console.log('Could not find appropriate container to tag');
                            }
                          } else {
                            console.log('No container found from chartWrapper');
                          }
                        } catch (e) {
                          console.error('Error in DOM traversal:', e);
                        }
                      }, 500); // Give charts time to render
                    } catch (e) {
                      console.error('Failed to get chart from wrapper', e);
                    }
                  }
                }
              ]}
            />
          </div>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: tableHtml }} />
        )}
      </div>
    </div>
  );
};

export default TableChartToggle;
