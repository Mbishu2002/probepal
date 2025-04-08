'use client';

import React, { useState, useRef } from 'react';
import { File, Settings, Database, Plus, Trash2, X, Download, BarChart2, List } from 'lucide-react';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { ModelSelector } from './ModelSelector';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface FileItem {
  id: string;
  name: string;
  data: any[];
}

interface SidebarProps {
  files: FileItem[];
  activeFileId: string | null;
  onFileSelect: (fileId: string) => void;
  onAddFile: (file: File) => void;
  onRemoveFile: (fileId: string) => void;
  onGenerate: (analysisStyle: string) => void;
  isGenerating: boolean;
  onModelChange: (model: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  files,
  activeFileId,
  onFileSelect,
  onAddFile,
  onRemoveFile,
  onGenerate, 
  isGenerating,
  onModelChange 
}) => {
  const { remainingExports, isUnlimited } = useSubscription();
  const { user } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [analysisStyle, setAnalysisStyle] = useState<string>('question-by-question');

  const handleFileUpload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      router.push('/auth');
      return;
    }

    if (!isUnlimited && remainingExports <= 0) {
      alert('You have no exports remaining. Please upgrade your plan.');
      return;
    }

    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        // Check if file is Excel
        if (!file.name.match(/\.(xlsx|xls)$/i)) {
          alert('Please upload an Excel file (.xlsx or .xls)');
          return;
        }
        
        onAddFile(file);
      } catch (error) {
        console.error('Error processing file:', error);
        alert('Error processing file. Please try again.');
      }
    }
    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full md:w-64 bg-white border-r border-gray-200 h-full flex flex-col overflow-y-auto p-0 pt-0 pb-0 pl-0">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <Database className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold">Data Analysis</h2>
        </div>
      </div>
      
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-500">Documents</h3>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleFileUpload} 
            title="Add new document"
            disabled={!isUnlimited && remainingExports <= 0}
            className="hover:bg-blue-50 hover:text-blue-600"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx,.xls"
            className="hidden"
          />
        </div>
        
        {files.length === 0 ? (
          <div className="text-sm text-gray-500 italic">No documents added</div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {files.map((file) => (
              <div 
                key={file.id} 
                className={`flex items-center justify-between p-2 rounded-md text-sm cursor-pointer ${activeFileId === file.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'}`}
                onClick={() => onFileSelect(file.id)}
              >
                <div className="flex items-center space-x-2 truncate">
                  <File className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{file.name}</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0 opacity-70 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFile(file.id);
                  }}
                >
                  <Trash2 className="h-3 w-3 text-gray-400 hover:text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="p-4 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-500 mb-2">AI Model</h3>
        <ModelSelector onModelChange={onModelChange} />
      </div>

      <div className="p-4 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-500 mb-2">Analysis Style</h3>
        <Select value={analysisStyle} onValueChange={setAnalysisStyle}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select analysis style" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="question-by-question">
              <div className="flex items-center gap-2">
                <List className="h-4 w-4" />
                <span>Question by Question</span>
              </div>
            </SelectItem>
            <SelectItem value="section-by-section">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4" />
                <span>Section by Section</span>
              </div>
            </SelectItem>
            <SelectItem value="comprehensive">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span>Comprehensive Analysis</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="mt-auto p-4 border-t border-gray-200">
        <div className="flex items-center justify-between mb-2 text-sm text-gray-500">
          <span>Exports remaining:</span>
          <span className="font-medium">
            {isUnlimited ? 'Unlimited' : remainingExports}
          </span>
        </div>
        <Button 
          onClick={() => onGenerate(analysisStyle)} 
          disabled={isGenerating || files.length === 0 || !activeFileId}
          className={`w-full transition-all duration-200 ${
            isGenerating 
              ? 'bg-blue-500 hover:bg-blue-600 text-white' 
              : files.length === 0 || !activeFileId
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md hover:shadow-lg'
          }`}
        >
          {isGenerating ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Generating...</span>
            </div>
          ) : 'Generate Analysis'}
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;
