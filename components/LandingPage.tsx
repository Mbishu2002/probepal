'use client';

import React from 'react';
import { Upload } from 'lucide-react';
import { Button } from './ui/button';

interface LandingPageProps {
  onFileUpload: (file: File) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onFileUpload }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileUpload(files[0]);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-4 md:p-6 text-center">
      <div className="w-full max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-5xl font-bold mb-4 md:mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
          Research Assistant
        </h1>
        <p className="text-lg md:text-xl text-gray-600 mb-6 md:mb-10">
          Upload your data and get instant analysis, visualizations, and insights.
        </p>
        
        <div className="flex flex-col items-center space-y-6">
          <div 
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 md:p-12 w-full max-w-md cursor-pointer hover:border-blue-500 transition-colors"
            onClick={handleFileUploadClick}
          >
            <div className="flex flex-col items-center">
              <Upload className="h-8 w-8 md:h-12 md:w-12 text-gray-400 mb-4" />
              <p className="text-base md:text-lg font-medium">Upload your Excel file</p>
              <p className="text-xs md:text-sm text-gray-500 mt-2">Click to browse or drag and drop</p>
            </div>
          </div>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".xlsx,.xls,.csv" 
            className="hidden" 
          />
          
          <Button 
            onClick={handleFileUploadClick}
            className="px-4 md:px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors w-full md:w-auto"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Data
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
