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
import { FileText, Download, Edit2, Eye, Search, X } from 'lucide-react';
import TableChartToggle from './TableChartToggle';
import * as ReactDOM from 'react-dom/client';
import html2canvas from 'html2canvas';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

// Extend the window interface for our chart storage
declare global {
  interface Window {
    __chartInstances?: Array<{
      chart: any;
      getImageURI: (() => string | null) | null;
    }>;
  }
}

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
  
  // Find and replace state
  const [findText, setFindText] = useState<string>('');
  const [replaceText, setReplaceText] = useState<string>('');
  const [isFindDialogOpen, setIsFindDialogOpen] = useState<boolean>(false);
  const [matchCount, setMatchCount] = useState<number>(0);
  const [currentMatch, setCurrentMatch] = useState<number>(0);
  const [matches, setMatches] = useState<number[]>([]);
  
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

  // Highlight find matches in editor
  useEffect(() => {
    if (findText && editMode && textareaRef.current) {
      highlightMatches();
    }
  }, [findText, editMode, editableContent]);

  // Find all occurrences of a string in text
  const findAllOccurrences = (text: string, searchStr: string): number[] => {
    if (!searchStr) return [];
    
    const positions: number[] = [];
    let pos = text.indexOf(searchStr);
    
    while (pos !== -1) {
      positions.push(pos);
      pos = text.indexOf(searchStr, pos + 1);
    }
    
    return positions;
  };

  // Highlight matches in the textarea
  const highlightMatches = () => {
    if (!textareaRef.current || !findText) return;
    
    const positions = findAllOccurrences(editableContent, findText);
    setMatches(positions);
    setMatchCount(positions.length);
    
    if (positions.length > 0) {
      // Set current match if needed
      if (currentMatch >= positions.length) {
        setCurrentMatch(0);
      }
      
      // Focus and select the current match
      const start = positions[currentMatch];
      const end = start + findText.length;
      
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(start, end);
      
      // Scroll the textarea to the selection
      const textarea = textareaRef.current;
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
      const currentLineNumber = (textarea.value.substring(0, start).match(/\n/g) || []).length;
      textarea.scrollTop = lineHeight * currentLineNumber;
    }
  };

  // Go to next match
  const findNext = () => {
    if (matches.length === 0) return;
    
    const nextMatch = (currentMatch + 1) % matches.length;
    setCurrentMatch(nextMatch);
    highlightMatches();
  };

  // Go to previous match
  const findPrevious = () => {
    if (matches.length === 0) return;
    
    const prevMatch = (currentMatch - 1 + matches.length) % matches.length;
    setCurrentMatch(prevMatch);
    highlightMatches();
  };

  // Replace current match
  const replaceCurrent = () => {
    if (matches.length === 0 || !textareaRef.current) return;
    
    const startPos = matches[currentMatch];
    const endPos = startPos + findText.length;
    
    const newContent = 
      editableContent.substring(0, startPos) + 
      replaceText + 
      editableContent.substring(endPos);
    
    setEditableContent(newContent);
    
    // Update matches after replacing
    setTimeout(() => {
      const newMatches = findAllOccurrences(newContent, findText);
      setMatches(newMatches);
      setMatchCount(newMatches.length);
      
      // Adjust current match if needed
      if (currentMatch >= newMatches.length) {
        setCurrentMatch(Math.max(0, newMatches.length - 1));
      }
      
      // Select next match or reset selection
      if (newMatches.length > 0) {
        highlightMatches();
      } else {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(startPos + replaceText.length, startPos + replaceText.length);
      }
      
      if (onContentChange) {
        onContentChange(newContent);
      }
    }, 0);
  };

  // Replace all matches
  const replaceAll = () => {
    if (findText === '') return;
    
    const newContent = editableContent.split(findText).join(replaceText);
    setEditableContent(newContent);
    
    if (onContentChange) {
      onContentChange(newContent);
    }
    
    // Reset matches
    setMatches([]);
    setMatchCount(0);
    setCurrentMatch(0);
  };

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
      console.log('Found table containers:', tableContainers.length);
      
      if (tableContainers.length > 0) {
        let tempContent = editableContent;
        
        for (let i = 0; i < tableContainers.length; i++) {
          const container = tableContainers[i] as HTMLElement;
          const tableIndex = container.getAttribute('data-table-index');
          console.log(`Processing container ${i}, table index:`, tableIndex);
          
          // Check if this container has a chart that's being displayed
          const hasChart = container.getAttribute('data-has-chart') === 'true';
          console.log('Container has been tagged with data-has-chart:', hasChart);
          
          // Look for any chart-related elements
          const chartDiv = container.querySelector('.flex.justify-center.items-center');
          console.log('Found chart div with flex classes:', !!chartDiv);
          
          // If we have a potential chart container, try to capture it
          if (hasChart || (chartDiv && window.getComputedStyle(chartDiv).display !== 'none')) {
            try {
              console.log('Attempting to capture chart');
              
              // Get chart type from select
              const chartTypeSelect = container.querySelector('select');
              const chartTitle = chartTypeSelect ? chartTypeSelect.value : 'Chart';
              console.log('Chart title:', chartTitle);
              
              // Try different approaches to get the chart image
              let imageData: string | null = null;
              
              // 1. First check for chartInstance reference directly on container or chart div
              if (hasChart && (container as any).__chartInstance) {
                try {
                  const chart = (container as any).__chartInstance;
                  if (chart && typeof chart.getImageURI === 'function') {
                    imageData = chart.getImageURI();
                    console.log('Got image from container.__chartInstance:', !!imageData);
                  }
                } catch (e) {
                  console.error('Error getting image from container.__chartInstance:', e);
                }
              }
              
              // 2. Check for chartIndex reference and lookup in window.__chartInstances
              if (!imageData && (container as any).__chartIndex !== undefined && window.__chartInstances) {
                try {
                  const chartIndex = (container as any).__chartIndex;
                  const chartData = window.__chartInstances[chartIndex];
                  if (chartData && chartData.getImageURI) {
                    imageData = chartData.getImageURI();
                    console.log(`Got image from window.__chartInstances[${chartIndex}]:`, !!imageData);
                  }
                } catch (e) {
                  console.error('Error getting image from window.__chartInstances:', e);
                }
              }
              
              // 3. If still no image, try to find a visible chart in this container
              if (!imageData && chartDiv) {
                try {
                  // Look for all possible chart elements
                  const visCharts = chartDiv.querySelectorAll('div[dir="ltr"]');
                  console.log('Found possible chart elements:', visCharts.length);
                  
                  // Try to find one with a getImageURI method
                  for (let j = 0; j < visCharts.length; j++) {
                    const el = visCharts[j] as any;
                    if (el.__chartInstance && typeof el.__chartInstance.getImageURI === 'function') {
                      imageData = el.__chartInstance.getImageURI();
                      console.log(`Got image from visCharts[${j}].__chartInstance:`, !!imageData);
                      break;
                    }
                  }
                } catch (e) {
                  console.error('Error finding chart elements:', e);
                }
              }
              
              // 4. If all direct methods fail, try html2canvas as fallback
              if (!imageData && chartDiv) {
                console.log('Falling back to html2canvas');
                try {
                  // Give it a little time for any animations to complete
                  await new Promise(resolve => setTimeout(resolve, 500));
                  
                  // Use html2canvas to capture the chart
                  const canvasDocx = await html2canvas(chartDiv as HTMLElement, {
                    logging: true,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: null,
                    scale: 2 // Higher quality
                  });
                  imageData = canvasDocx.toDataURL('image/png');
                  console.log('Got image from html2canvas:', !!imageData, 'length:', imageData?.length);
                } catch (e) {
                  console.error('Error using html2canvas:', e);
                }
              }
              
              // If we have image data, replace the table with it
              if (imageData && imageData.length > 100) {  // Basic validation of image data
                // Find and replace the corresponding table in markdown
                const tableRegex = /\|[^\n]*\|[^\n]*\n\|[\s:-]*\|[\s:-]*\|[\s\S]*?(?=\n\n|$)/g;
                const tableMatches = tempContent.match(tableRegex) || [];
                console.log('Found table matches:', tableMatches.length);
                
                if (tableMatches[parseInt(tableIndex || '0')]) {
                  const targetTable = tableMatches[parseInt(tableIndex || '0')];
                  
                  // Create a nicely formatted markdown with the chart image
                  // Add proper spacing but no chart type title
                  const imageMarkdown = `

![Chart](${imageData})

`;
                  
                  tempContent = tempContent.replace(targetTable, imageMarkdown);
                  console.log('Replaced table with image in markdown');
                } else {
                  console.log('Table match not found for index:', tableIndex);
                }
              } else {
                console.log('Failed to get valid image data');
              }
            } catch (error) {
              console.error('Error capturing chart:', error);
            }
          } else {
            console.log('Chart not visible or not found');
          }
        }
        contentToExport = tempContent;
      }
      
      console.log('Exporting to DOCX');
      await exportToDocx(contentToExport, `${documentTitle || 'research_document'}.docx`);
      console.log('Export complete');
    } catch (error) {
      console.error('Error exporting to DOCX:', error);
    }
  };

  const handleExportPdf = async () => {
    try {
      let contentToExport = editableContent;
      
      // Find all table containers
      const tableContainers = document.querySelectorAll('[data-table-index]');
      console.log('Found table containers for PDF:', tableContainers.length);
      
      if (tableContainers.length > 0) {
        let tempContent = editableContent;
        
        for (let i = 0; i < tableContainers.length; i++) {
          const container = tableContainers[i] as HTMLElement;
          const tableIndex = container.getAttribute('data-table-index');
          console.log(`Processing container ${i} for PDF, table index:`, tableIndex);
          
          // Check if this container has a chart that's being displayed
          const hasChart = container.getAttribute('data-has-chart') === 'true';
          console.log('Container has been tagged with data-has-chart for PDF:', hasChart);
          
          // Look for any chart-related elements
          const chartDiv = container.querySelector('.flex.justify-center.items-center');
          console.log('Found chart div with flex classes for PDF:', !!chartDiv);
          
          // If we have a potential chart container, try to capture it
          if (hasChart || (chartDiv && window.getComputedStyle(chartDiv).display !== 'none')) {
            try {
              console.log('Attempting to capture chart for PDF');
              
              // Get chart type from select
              const chartTypeSelect = container.querySelector('select');
              const chartTitle = chartTypeSelect ? chartTypeSelect.value : 'Chart';
              console.log('Chart title for PDF:', chartTitle);
              
              // Try different approaches to get the chart image
              let imageData: string | null = null;
              
              // 1. First check for chartInstance reference directly on container or chart div
              if (hasChart && (container as any).__chartInstance) {
                try {
                  const chart = (container as any).__chartInstance;
                  if (chart && typeof chart.getImageURI === 'function') {
                    imageData = chart.getImageURI();
                    console.log('Got image from container.__chartInstance for PDF:', !!imageData);
                  }
                } catch (e) {
                  console.error('Error getting image from container.__chartInstance for PDF:', e);
                }
              }
              
              // 2. Check for chartIndex reference and lookup in window.__chartInstances
              if (!imageData && (container as any).__chartIndex !== undefined && window.__chartInstances) {
                try {
                  const chartIndex = (container as any).__chartIndex;
                  const chartData = window.__chartInstances[chartIndex];
                  if (chartData && chartData.getImageURI) {
                    imageData = chartData.getImageURI();
                    console.log(`Got image from window.__chartInstances[${chartIndex}] for PDF:`, !!imageData);
                  }
                } catch (e) {
                  console.error('Error getting image from window.__chartInstances for PDF:', e);
                }
              }
              
              // 3. If still no image, try to find a visible chart in this container
              if (!imageData && chartDiv) {
                try {
                  // Look for all possible chart elements
                  const visCharts = chartDiv.querySelectorAll('div[dir="ltr"]');
                  console.log('Found possible chart elements for PDF:', visCharts.length);
                  
                  // Try to find one with a getImageURI method
                  for (let j = 0; j < visCharts.length; j++) {
                    const el = visCharts[j] as any;
                    if (el.__chartInstance && typeof el.__chartInstance.getImageURI === 'function') {
                      imageData = el.__chartInstance.getImageURI();
                      console.log(`Got image from visCharts[${j}].__chartInstance for PDF:`, !!imageData);
                      break;
                    }
                  }
                } catch (e) {
                  console.error('Error finding chart elements for PDF:', e);
                }
              }
              
              // 4. If all direct methods fail, try html2canvas as fallback
              if (!imageData && chartDiv) {
                console.log('Falling back to html2canvas for PDF');
                try {
                  // Give it a little time for any animations to complete
                  await new Promise(resolve => setTimeout(resolve, 500));
                  
                  // Use html2canvas to capture the chart
                  const canvasPdf = await html2canvas(chartDiv as HTMLElement, {
                    logging: true,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: null,
                    scale: 2 // Higher quality
                  });
                  imageData = canvasPdf.toDataURL('image/png');
                  console.log('Got image from html2canvas for PDF:', !!imageData, 'length:', imageData?.length);
                } catch (e) {
                  console.error('Error using html2canvas for PDF:', e);
                }
              }
              
              // If we have image data, replace the table with it
              if (imageData && imageData.length > 100) {  // Basic validation of image data
                // Find and replace the corresponding table in markdown
                const tableRegex = /\|[^\n]*\|[^\n]*\n\|[\s:-]*\|[\s:-]*\|[\s\S]*?(?=\n\n|$)/g;
                const tableMatches = tempContent.match(tableRegex) || [];
                console.log('Found table matches for PDF:', tableMatches.length);
                
                if (tableMatches[parseInt(tableIndex || '0')]) {
                  const targetTable = tableMatches[parseInt(tableIndex || '0')];
                  
                  // Create a nicely formatted markdown with the chart image
                  // Add proper spacing but no chart type title
                  const imageMarkdown = `

![Chart](${imageData})

`;
                  
                  tempContent = tempContent.replace(targetTable, imageMarkdown);
                  console.log('Replaced table with image in markdown for PDF');
                } else {
                  console.log('Table match not found for index for PDF:', tableIndex);
                }
              } else {
                console.log('Failed to get valid image data for PDF');
              }
            } catch (error) {
              console.error('Error capturing chart for PDF:', error);
            }
          } else {
            console.log('Chart not visible or not found for PDF');
          }
        }
        contentToExport = tempContent;
      }
      
      console.log('Exporting to PDF');
      await exportToPdf(contentToExport, `${documentTitle || 'research_document'}.pdf`);
      console.log('PDF Export complete');
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
            {editMode && (
              <Dialog open={isFindDialogOpen} onOpenChange={setIsFindDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs flex items-center"
                  >
                    <Search className="h-3.5 w-3.5 mr-1" />
                    Find & Replace
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Find and Replace</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Find text..."
                          value={findText}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFindText(e.target.value)}
                          className="flex-1"
                        />
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={findPrevious}
                          disabled={matchCount === 0}
                        >
                          Previous
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={findNext}
                          disabled={matchCount === 0}
                        >
                          Next
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500">
                        {matchCount > 0 ? `Match ${currentMatch + 1} of ${matchCount}` : 'No matches found'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Input
                        placeholder="Replace with..."
                        value={replaceText}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReplaceText(e.target.value)}
                      />
                      <div className="flex justify-end gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={replaceCurrent}
                          disabled={matchCount === 0}
                        >
                          Replace
                        </Button>
                        <Button 
                          size="sm" 
                          variant="default" 
                          onClick={replaceAll}
                          disabled={matchCount === 0}
                        >
                          Replace All
                        </Button>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
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
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
              const newContent = e.target.value;
              setEditableContent(newContent);
              if (onContentChange) {
                onContentChange(newContent);
              }
            }}
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
