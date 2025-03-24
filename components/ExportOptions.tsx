'use client';

import React from 'react';

interface ExportOptionsProps {
  onExportPDF: () => void;
  onExportWord: () => void;
}

const ExportOptions: React.FC<ExportOptionsProps> = ({ onExportPDF, onExportWord }) => {
  return (
    <div className="space-y-3">
      <button
        onClick={onExportPDF}
        className="w-full flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
      >
        <svg 
          className="w-5 h-5 mr-2" 
          fill="currentColor" 
          viewBox="0 0 20 20" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            fillRule="evenodd" 
            d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" 
            clipRule="evenodd"
          ></path>
        </svg>
        Export as PDF
      </button>
      
      <button
        onClick={onExportWord}
        className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
      >
        <svg 
          className="w-5 h-5 mr-2" 
          fill="currentColor" 
          viewBox="0 0 20 20" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            fillRule="evenodd" 
            d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm2 10a1 1 0 01-1-1V8a1 1 0 112 0v3a1 1 0 01-1 1zm3-1V8a1 1 0 112 0v3a1 1 0 11-2 0z" 
            clipRule="evenodd"
          ></path>
        </svg>
        Export as Word
      </button>
    </div>
  );
};

export default ExportOptions;
