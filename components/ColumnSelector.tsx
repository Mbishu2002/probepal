'use client';

import React from 'react';

interface ColumnSelectorProps {
  columns: string[];
  selectedColumns: string[];
  onColumnSelect: (column: string) => void;
}

const ColumnSelector: React.FC<ColumnSelectorProps> = ({ 
  columns, 
  selectedColumns, 
  onColumnSelect 
}) => {
  return (
    <div className="space-y-2 max-h-60 overflow-y-auto">
      {columns.map(column => (
        <div key={column} className="flex items-center">
          <input
            type="checkbox"
            id={`column-${column}`}
            checked={selectedColumns.includes(column)}
            onChange={() => onColumnSelect(column)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label 
            htmlFor={`column-${column}`} 
            className="ml-2 block text-sm text-gray-900 truncate"
            title={column}
          >
            {column}
          </label>
        </div>
      ))}
    </div>
  );
};

export default ColumnSelector;
