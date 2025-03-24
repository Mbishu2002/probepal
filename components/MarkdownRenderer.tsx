'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { exportToDocx, exportToPdf } from '../lib/fileConversion';

interface MarkdownRendererProps {
  content: string;
  isLoading: boolean;
  onContentChange?: (content: string) => void;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  content, 
  isLoading,
  onContentChange 
}) => {
  const [documentTitle, setDocumentTitle] = useState<string>('Research Results');
  const [showSource, setShowSource] = useState<boolean>(false);
  
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDocumentTitle(e.target.value);
  };

  const handleExportDocx = () => {
    exportToDocx(content, `${documentTitle}.docx`);
  };

  const handleExportPdf = () => {
    exportToPdf(content, `${documentTitle}.pdf`);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Custom components for markdown rendering
  const components = {
    table: (props: any) => (
      <div className="overflow-x-auto my-8">
        <table className="min-w-full divide-y divide-gray-300 border" {...props} />
      </div>
    ),
    thead: (props: any) => <thead className="bg-gray-50" {...props} />,
    tbody: (props: any) => <tbody className="divide-y divide-gray-200 bg-white" {...props} />,
    tr: (props: any) => <tr className="hover:bg-gray-50" {...props} />,
    th: (props: any) => <th className="py-3.5 px-4 text-left text-sm font-semibold text-gray-900" {...props} />,
    td: (props: any) => <td className="py-2 px-4 text-sm text-gray-500" {...props} />,
    h1: (props: any) => <h1 className="text-3xl font-bold mt-8 mb-4" {...props} />,
    h2: (props: any) => <h2 className="text-2xl font-bold mt-6 mb-3" {...props} />,
    h3: (props: any) => <h3 className="text-xl font-bold mt-4 mb-2" {...props} />,
    p: (props: any) => <p className="my-4" {...props} />,
    ul: (props: any) => <ul className="list-disc pl-5 my-4" {...props} />,
    ol: (props: any) => <ol className="list-decimal pl-5 my-4" {...props} />,
    li: (props: any) => <li className="mb-1" {...props} />,
  };

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden">
      {/* Document header */}
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <input
            type="text"
            value={documentTitle}
            onChange={handleTitleChange}
            className="text-lg font-medium border-none focus:ring-0 bg-transparent"
            placeholder="Research Results"
          />
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowSource(!showSource)}
            className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
          >
            {showSource ? 'Show Rendered' : 'Show Source'}
          </button>
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

      {/* Document content area */}
      <div className="p-6 bg-white">
        {showSource ? (
          <div className="font-mono text-sm bg-gray-100 p-4 rounded overflow-auto whitespace-pre-wrap border border-gray-300">
            {content}
          </div>
        ) : (
          <div className="markdown-content">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={components}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Add custom CSS for markdown */}
      <style jsx global>{`
        .markdown-content table {
          border-collapse: collapse;
          width: 100%;
          margin: 1rem 0;
        }
        .markdown-content th,
        .markdown-content td {
          border: 1px solid #e5e7eb;
          padding: 0.5rem;
          text-align: left;
        }
        .markdown-content th {
          background-color: #f9fafb;
          font-weight: 600;
        }
        .markdown-content tr:nth-child(even) {
          background-color: #f3f4f6;
        }
        .markdown-content h1 {
          font-size: 1.875rem;
          font-weight: 700;
          margin-top: 2rem;
          margin-bottom: 1rem;
        }
        .markdown-content h2 {
          font-size: 1.5rem;
          font-weight: 700;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .markdown-content h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
        }
        .markdown-content p {
          margin-bottom: 1rem;
        }
        .markdown-content ul,
        .markdown-content ol {
          margin-left: 1.5rem;
          margin-bottom: 1rem;
        }
        .markdown-content li {
          margin-bottom: 0.25rem;
        }
      `}</style>
    </div>
  );
};

export default MarkdownRenderer;
