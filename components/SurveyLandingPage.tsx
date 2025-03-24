'use client';

import React, { useState, useRef } from 'react';
import { Upload, FileText, ClipboardList, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';

interface SurveyLandingPageProps {
  onFileUpload: (file: File) => void;
}

const SurveyLandingPage: React.FC<SurveyLandingPageProps> = ({ onFileUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndUploadFile(files[0]);
    }
  };

  const validateAndUploadFile = (file: File) => {
    setError(null);
    // Check if file is a Word document
    if (!file.name.endsWith('.docx')) {
      setError('Please upload a Word document (.docx)');
      return;
    }
    
    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size exceeds 10MB limit');
      return;
    }
    
    onFileUpload(file);
  };

  // Handle drag events
  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  // Handle drop event
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndUploadFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-4 md:p-6 text-center">
      <div className="w-full max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-5xl font-bold mb-4 md:mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
          Survey Data Collection
        </h1>
        <p className="text-lg md:text-xl text-gray-600 mb-6 md:mb-10">
          Upload your survey document and instantly convert it to an answerable form with frequency count analysis
        </p>
        
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4 mr-2" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div className="flex flex-col items-center space-y-6">
          <div 
            className={`border-2 border-dashed rounded-lg p-6 md:p-12 w-full max-w-md cursor-pointer transition-colors ${
              dragActive 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-blue-500'
            }`}
            onClick={handleFileUploadClick}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center">
              <FileText className={`h-8 w-8 md:h-12 md:w-12 mb-4 ${dragActive ? 'text-blue-500' : 'text-gray-400'}`} />
              <p className="text-base md:text-lg font-medium">Upload your survey document</p>
              <p className="text-xs md:text-sm text-gray-500 mt-2">Click to browse or drag and drop (.docx)</p>
            </div>
          </div>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".docx" 
            className="hidden" 
          />
          
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4 w-full max-w-md">
            <Button 
              onClick={handleFileUploadClick}
              className="px-4 md:px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Survey Document
            </Button>
          </div>
          
          <div className="mt-8 bg-gray-50 p-6 rounded-lg border border-gray-200 w-full max-w-2xl">
            <h3 className="text-lg font-medium mb-3">How it works:</h3>
            <ol className="list-decimal list-inside space-y-2 text-left text-gray-700">
              <li>Upload your survey document (.docx format)</li>
              <li>AI converts it to an answerable survey form without changing its structure</li>
              <li>Fill out the survey responses</li>
              <li>View frequency counts and analytics</li>
              <li>Export collected data to Excel for further analysis</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SurveyLandingPage;
