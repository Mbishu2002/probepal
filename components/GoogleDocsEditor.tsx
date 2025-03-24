'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { exportToDocx, exportToPdf } from '../lib/fileConversion';

// Dynamically import ReactQuill to avoid SSR issues
const ReactQuill = dynamic(() => import('react-quill'), {
  ssr: false,
  loading: () => <div className="h-64 flex items-center justify-center">Loading Editor...</div>,
});

// Import CSS for ReactQuill
import 'react-quill/dist/quill.snow.css';

interface GoogleDocsEditorProps {
  initialContent: string;
  isLoading: boolean;
  onContentChange?: (content: string) => void;
}

const GoogleDocsEditor: React.FC<GoogleDocsEditorProps> = ({ 
  initialContent, 
  isLoading,
  onContentChange 
}) => {
  const [content, setContent] = useState<string>('');
  const [documentTitle, setDocumentTitle] = useState<string>('Untitled Document');
  const quillRef = useRef<any>(null);

  // Convert markdown to HTML for the editor
  useEffect(() => {
    if (initialContent) {
      // Simple markdown to HTML conversion
      let htmlContent = initialContent
        // Headers
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/_(.+?)_/g, '<em>$1</em>')
        // Lists
        .replace(/^\* (.+)$/gm, '<ul><li>$1</li></ul>')
        .replace(/^\d+\. (.+)$/gm, '<ol><li>$1</li></ol>')
        // Tables - more complex, would need a proper parser
        // For now, just preserve them as pre-formatted
        .replace(/\|(.+)\|/g, '<pre>|$1|</pre>')
        // Preserve editable sections
        .replace(/<EDITABLE span-id='([^']+)'>([\s\S]*?)<\/EDITABLE>/g, 
                '<div class="editable" data-id="$1">$2</div>');
      
      setContent(htmlContent);
    }
  }, [initialContent]);

  const handleChange = (value: string) => {
    setContent(value);
    if (onContentChange) {
      // Convert HTML back to markdown or the format you need
      onContentChange(value);
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDocumentTitle(e.target.value);
  };

  const handleExportDocx = () => {
    // Convert HTML to markdown or the format needed for export
    const markdownContent = content
      // Convert back to markdown or keep as HTML depending on your export function
      .replace(/<h1>(.+?)<\/h1>/g, '# $1')
      .replace(/<h2>(.+?)<\/h2>/g, '## $1')
      .replace(/<h3>(.+?)<\/h3>/g, '### $1')
      .replace(/<strong>(.+?)<\/strong>/g, '**$1**')
      .replace(/<em>(.+?)<\/em>/g, '_$1_')
      .replace(/<div class="editable" data-id="([^"]+)">([\s\S]*?)<\/div>/g, 
              '<EDITABLE span-id=\'$1\'>$2</EDITABLE>');
    
    exportToDocx(markdownContent, `${documentTitle}.docx`);
  };

  const handleExportPdf = () => {
    // Similar conversion for PDF
    const markdownContent = content
      .replace(/<h1>(.+?)<\/h1>/g, '# $1')
      .replace(/<h2>(.+?)<\/h2>/g, '## $1')
      .replace(/<h3>(.+?)<\/h3>/g, '### $1')
      .replace(/<strong>(.+?)<\/strong>/g, '**$1**')
      .replace(/<em>(.+?)<\/em>/g, '_$1_')
      .replace(/<div class="editable" data-id="([^"]+)">([\s\S]*?)<\/div>/g, 
              '<EDITABLE span-id=\'$1\'>$2</EDITABLE>');
    
    exportToPdf(markdownContent, `${documentTitle}.pdf`);
  };

  // Quill editor modules and formats
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'align': [] }],
      ['link', 'image'],
      ['clean']
    ],
  };

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'color', 'background',
    'align',
    'link', 'image'
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden">
      {/* Google Docs-like header */}
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <input
            type="text"
            value={documentTitle}
            onChange={handleTitleChange}
            className="text-lg font-medium border-none focus:ring-0 bg-transparent"
            placeholder="Untitled Document"
          />
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleExportDocx}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Export DOCX
          </button>
          <button
            onClick={handleExportPdf}
            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* Menu bar similar to Google Docs */}
      <div className="border-b border-gray-200 bg-white">
        {/* ReactQuill will render its toolbar here */}
      </div>

      {/* Document content area */}
      <div className="p-0 bg-white">
        <ReactQuill
          ref={quillRef}
          value={content}
          onChange={handleChange}
          modules={modules}
          formats={formats}
          theme="snow"
          placeholder="Start typing or upload a file..."
          className="h-[calc(100vh-200px)] overflow-y-auto"
        />
      </div>
    </div>
  );
};

export default GoogleDocsEditor;
