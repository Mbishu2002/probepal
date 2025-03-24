'use client';

import React, { useState, useRef, useEffect } from 'react';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { exportToDocx, exportToPdf } from '../lib/fileConversion';
import { Button } from './ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Separator } from './ui/separator';
import { FileText, Download, Edit2, Eye } from 'lucide-react';
import TableChartToggle from './TableChartToggle';
import * as ReactDOM from 'react-dom/client';

interface EditableMarkdownProps {
  content: string;
  isLoading: boolean;
  onContentChange?: (content: string) => void;
}

const EditableMarkdown: React.FC<EditableMarkdownProps> = ({ 
  content, 
  isLoading,
  onContentChange 
}) => {
  const [documentTitle, setDocumentTitle] = useState<string>('Research Results');
  const [editMode, setEditMode] = useState<boolean>(false);
  const [editableContent, setEditableContent] = useState<string>(content);
  const [renderedHtml, setRenderedHtml] = useState<string>('');
  const [tables, setTables] = useState<{html: string, data: any[], options?: any}[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Process markdown content when it changes
  useEffect(() => {
    setEditableContent(content);
    renderMarkdown(content);
  }, [content]);

  // Re-render markdown when in preview mode and content changes
  useEffect(() => {
    if (!editMode) {
      renderMarkdown(editableContent);
    }
  }, [editableContent, editMode]);

  // Extract tables from markdown
  const extractTables = (markdown: string) => {
    const tables: {html: string, data: any[], options?: any}[] = [];
    
    // Find all tables in the markdown
    const tableMatches = markdown.match(/\|[^\n]*\|[^\n]*\n\|[\s:-]*\|[\s:-]*\|[\s\S]*?(?=\n\n|$)/g);
    
    if (tableMatches) {
      tableMatches.forEach(tableMatch => {
        // Check for chart options before the table
        let chartOptions = {};
        const optionsMatch = tableMatch.match(/<!--\s*chart-options\s*(\{[^}]+\})\s*-->/);
        if (optionsMatch && optionsMatch[1]) {
          try {
            chartOptions = JSON.parse(optionsMatch[1]);
          } catch (e) {
            console.error('Failed to parse chart options:', e);
          }
        }

        const lines = tableMatch.split('\n').filter(line => line.trim() !== '');
        
        if (lines.length >= 2) { // Need at least header and separator
          const headerRow = lines[0];
          const headers = headerRow
            .split('|')
            .filter(cell => cell.trim() !== '')
            .map(cell => cell.trim());
          
          const data: any[] = [];
          
          // Start from line 2 (skip header and separator)
          for (let i = 2; i < lines.length; i++) {
            const rowCells = lines[i]
              .split('|')
              .filter(cell => cell.trim() !== '')
              .map(cell => cell.trim());
            
            if (rowCells.length === headers.length) {
              const rowData: Record<string, any> = {};
              headers.forEach((header, index) => {
                // Try to convert to number if possible
                const value = rowCells[index];
                const numValue = Number(value);
                rowData[header] = isNaN(numValue) ? value : numValue;
              });
              data.push(rowData);
            }
          }
          
          // Create HTML for the table
          let tableHtml = '<table class="min-w-full divide-y divide-gray-300 border">';
          
          // Add header
          tableHtml += '<thead class="bg-gray-50"><tr>';
          headers.forEach(header => {
            tableHtml += `<th class="py-3.5 px-4 text-left text-sm font-semibold text-gray-900">${header}</th>`;
          });
          tableHtml += '</tr></thead>';
          
          // Add body
          tableHtml += '<tbody class="divide-y divide-gray-200 bg-white">';
          data.forEach(row => {
            tableHtml += '<tr class="hover:bg-gray-50">';
            headers.forEach(header => {
              tableHtml += `<td class="py-2 px-4 text-sm text-gray-500">${row[header]}</td>`;
            });
            tableHtml += '</tr>';
          });
          tableHtml += '</tbody></table>';
          
          tables.push({
            html: tableHtml,
            data: data,
            options: chartOptions
          });
        }
      });
    }
    
    return tables;
  };

  // Render markdown to HTML using remark
  const renderMarkdown = async (markdownContent: string) => {
    try {
      // Extract tables before processing markdown
      const extractedTables = extractTables(markdownContent);
      setTables(extractedTables);
      
      const result = await unified()
        .use(remarkParse) // Parse markdown to mdast
        .use(remarkGfm) // Support GFM (tables, autolinks, etc.)
        .use(remarkRehype) // Convert mdast to hast
        .use(rehypeSanitize) // Sanitize HTML
        .use(rehypeStringify) // Convert hast to HTML
        .process(markdownContent);
      
      let html = String(result);
      
      // Replace table HTML with our custom table component placeholder
      if (extractedTables.length > 0) {
        const tableRegex = /<table>[\s\S]*?<\/table>/g;
        let tableIndex = 0;
        
        html = html.replace(tableRegex, (match, index) => {
          const table = extractedTables[tableIndex];
          const options = table.options ? `data-chart-options='${JSON.stringify(table.options)}'` : '';
          const placeholder = `<div id="table-placeholder-${tableIndex}" ${options}></div>`;
          tableIndex++;
          return placeholder;
        });
      }
      
      setRenderedHtml(html);
    } catch (error) {
      console.error('Error rendering markdown:', error);
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDocumentTitle(e.target.value);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setEditableContent(newContent);
    if (onContentChange) {
      onContentChange(newContent);
    }
  };

  const handleExportDocx = async () => {
    try {
      let contentToExport = editableContent;
      
      // Find all table containers
      const tableContainers = document.querySelectorAll('[data-table-index]');
      if (tableContainers.length > 0) {
        let tempContent = editableContent;
        
        for (let i = 0; i < tableContainers.length; i++) {
          const container = tableContainers[i] as HTMLElement;
          const tableIndex = container.getAttribute('data-table-index');
          
          // Check if chart is visible (table is hidden)
          const chartDiv = container.querySelector('.google-visualization-chartWrapper');
          if (chartDiv && window.getComputedStyle(chartDiv).display !== 'none') {
            const canvas = container.querySelector('canvas');
            if (canvas) {
              try {
                // Get chart type from select
                const chartTypeSelect = container.querySelector('select');
                const chartTitle = chartTypeSelect ? chartTypeSelect.value : 'Chart';
                
                // Convert canvas to base64 image
                const imageData = canvas.toDataURL('image/png');
                
                // Find and replace the corresponding table in markdown
                const tableRegex = /\|[^\n]*\|[^\n]*\n\|[\s:-]*\|[\s:-]*\|[\s\S]*?(?=\n\n|$)/g;
                const tableMatches = tempContent.match(tableRegex) || [];
                
                if (tableMatches[parseInt(tableIndex || '0')]) {
                  const targetTable = tableMatches[parseInt(tableIndex || '0')];
                  // Add proper spacing before and after the chart
                  const imageMarkdown = `\n\n![${chartTitle}](${imageData})\n\n`;
                  tempContent = tempContent.replace(targetTable, imageMarkdown);
                }
              } catch (error) {
                console.error('Error capturing chart:', error);
              }
            }
          }
        }
        contentToExport = tempContent;
      }
      
      await exportToDocx(contentToExport, `${documentTitle || 'research_document'}.docx`);
    } catch (error) {
      console.error('Error exporting to DOCX:', error);
    }
  };

  const handleExportPdf = async () => {
    try {
      let contentToExport = editableContent;
      
      // Find all table containers
      const tableContainers = document.querySelectorAll('[data-table-index]');
      if (tableContainers.length > 0) {
        let tempContent = editableContent;
        
        for (let i = 0; i < tableContainers.length; i++) {
          const container = tableContainers[i] as HTMLElement;
          const tableIndex = container.getAttribute('data-table-index');
          
          // Check if chart is visible (table is hidden)
          const chartDiv = container.querySelector('.google-visualization-chartWrapper');
          if (chartDiv && window.getComputedStyle(chartDiv).display !== 'none') {
            const canvas = container.querySelector('canvas');
            if (canvas) {
              try {
                // Get chart type from select
                const chartTypeSelect = container.querySelector('select');
                const chartTitle = chartTypeSelect ? chartTypeSelect.value : 'Chart';
                
                // Convert canvas to base64 image
                const imageData = canvas.toDataURL('image/png');
                
                // Find and replace the corresponding table in markdown
                const tableRegex = /\|[^\n]*\|[^\n]*\n\|[\s:-]*\|[\s:-]*\|[\s\S]*?(?=\n\n|$)/g;
                const tableMatches = tempContent.match(tableRegex) || [];
                
                if (tableMatches[parseInt(tableIndex || '0')]) {
                  const targetTable = tableMatches[parseInt(tableIndex || '0')];
                  // Add proper spacing before and after the chart
                  const imageMarkdown = `\n\n![${chartTitle}](${imageData})\n\n`;
                  tempContent = tempContent.replace(targetTable, imageMarkdown);
                }
              } catch (error) {
                console.error('Error capturing chart:', error);
              }
            }
          }
        }
        contentToExport = tempContent;
      }
      
      await exportToPdf(contentToExport, `${documentTitle || 'research_document'}.pdf`);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current && editMode) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [editableContent, editMode]);

  // Replace table placeholders with actual TableChartToggle components
  useEffect(() => {
    if (renderedHtml && !editMode) {
      // Find all table placeholders and replace them with the actual tables
      const placeholders = document.querySelectorAll('[id^="table-placeholder-"]');
      placeholders.forEach((placeholder, index) => {
        const table = tables[index];
        if (table) {
          // Get chart options if they exist
          const chartOptions = placeholder.getAttribute('data-chart-options');
          const options = chartOptions ? JSON.parse(chartOptions) : undefined;
          
          // Create a container for the table and chart
          const container = document.createElement('div');
          container.className = 'my-4';
          container.setAttribute('data-table-index', index.toString());
          
          // Add the chart toggle component
          const chartToggle = document.createElement('div');
          container.appendChild(chartToggle);
          
          // Replace the placeholder with our container
          placeholder.replaceWith(container);
          
          // Render the TableChartToggle component
          const root = ReactDOM.createRoot(chartToggle);
          root.render(
            <TableChartToggle
              tableHtml={table.html}
              tableData={table.data}
              initialOptions={options}
            />
          );
        }
      });
    }
  }, [renderedHtml, editMode, tables]);

  if (isLoading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-500 text-center">
          Generating analysis...<br />
          <span className="text-sm">This may take a moment depending on the size of your data.</span>
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <FileText className="h-5 w-5 text-gray-500" />
          <input
            type="text"
            value={documentTitle}
            onChange={(e) => setDocumentTitle(e.target.value)}
            className="font-medium focus:outline-none focus:border-b focus:border-blue-500"
            placeholder="Document Title"
          />
        </div>
        <div className="flex space-x-2">
          <Tabs defaultValue={editMode ? "edit" : "preview"} className="w-auto">
            <TabsList className="grid w-[180px] grid-cols-2">
              <TabsTrigger 
                value="edit" 
                onClick={() => setEditMode(true)}
                className="flex items-center space-x-1"
              >
                <Edit2 className="h-3.5 w-3.5 mr-1" />
                Edit
              </TabsTrigger>
              <TabsTrigger 
                value="preview" 
                onClick={() => setEditMode(false)}
                className="flex items-center space-x-1"
              >
                <Eye className="h-3.5 w-3.5 mr-1" />
                Preview
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex space-x-1">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExportPdf}
              className="text-xs flex items-center"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              PDF
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExportDocx}
              className="text-xs flex items-center"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              DOCX
            </Button>
          </div>
        </div>
      </div>
      
      {editMode ? (
        <div className="p-4">
          <textarea
            ref={textareaRef}
            value={editableContent}
            onChange={(e) => setEditableContent(e.target.value)}
            className="w-full min-h-[500px] focus:outline-none resize-none"
          />
        </div>
      ) : (
        <div 
          className="p-4 prose prose-blue max-w-none markdown-content" 
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      )}
    </div>
  );
};

export default EditableMarkdown;
