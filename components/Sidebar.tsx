'use client';

import React, { useState } from 'react';
import { File, Settings, Database, Plus, Trash2, X } from 'lucide-react';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { ModelSelector } from './ModelSelector';

interface FileItem {
  id: string;
  name: string;
  data: any[];
}

interface SidebarProps {
  files: FileItem[];
  activeFileId: string | null;
  onFileSelect: (fileId: string) => void;
  onAddFile: () => void;
  onRemoveFile: (fileId: string) => void;
  onGenerate: () => void;
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
  return (
    <div className="w-full md:w-64 bg-white border-r border-gray-200 h-full p-4 flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Database className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold">Data Analysis</h2>
        </div>
      </div>
      
      <Separator className="mb-4" />
      
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-500">Documents</h3>
          <Button variant="ghost" size="sm" onClick={onAddFile} title="Add new document">
            <Plus className="h-4 w-4" />
          </Button>
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
      
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-500 mb-2">AI Model</h3>
        <ModelSelector onModelChange={onModelChange} />
      </div>
      
      <div className="mt-auto">
        <Button 
          onClick={onGenerate} 
          disabled={isGenerating || files.length === 0 || !activeFileId}
          className="w-full"
        >
          {isGenerating ? 'Generating...' : 'Generate Analysis'}
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;
