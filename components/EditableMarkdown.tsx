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
import { useAuth } from '@/contexts/AuthContext';
import { trackDocumentExport, getRemainingExports } from '@/lib/subscription';
import { useRouter } from 'next/navigation';

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
  documentId?: string;
  isSuperUser?: boolean;
}

const EditableMarkdown: React.FC<EditableMarkdownProps> = ({ 
  content, 
  isLoading,
  onContentChange,
  documentId,
  isSuperUser 
}) => {
  const router = useRouter();
  const { user } = useAuth();
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
  
  const [remainingExports, setRemainingExports] = useState<{ remaining: number; plan: string } | null>(null);

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

  const handleExport = async (format: 'docx' | 'pdf') => {
    if (!user) {
      router.push('/auth');
      return;
    }

    // Check if user has remaining exports, bypass for fmbishu@gmail.com
    if (user.email !== 'fmbishu@gmail.com' && remainingExports?.remaining === 0) {
      alert('You have reached your export limit. Please upgrade your plan to continue exporting.');
      router.push('/pricing');
      return;
    }

    try {
      const response = await fetch('/api/documents/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId,
          userId: user.id,
          format,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to export document');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export-${documentId}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Update remaining exports count
      if (!isSuperUser && remainingExports) {
        setRemainingExports({
          ...remainingExports,
          remaining: remainingExports.remaining - 1
        });
      }

      // Show success message (don't show remaining exports for fmbishu@gmail.com)
      const message = user.email === 'fmbishu@gmail.com' 
        ? 'Document exported successfully!' 
        : `Document exported successfully! You have ${remainingExports?.remaining || 0} exports remaining.`;
      alert(message);
    } catch (error: any) {
      console.error('Error exporting document:', error);
      alert(error.message || 'Failed to export document');
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

  useEffect(() => {
    const fetchRemainingExports = async () => {
      if (user) {
        try {
          const exports = await getRemainingExports(user.id);
          setRemainingExports(exports);
        } catch (error) {
          console.error('Error fetching remaining exports:', error);
        }
      }
    };

    fetchRemainingExports();
  }, [user]);

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
          {isSuperUser && (
            <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
              Super User
            </span>
          )}
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
              onClick={() => handleExport('pdf')}
              className="text-xs flex items-center"
              disabled={!user || !documentId}
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              PDF
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleExport('docx')}
              className="text-xs flex items-center"
              disabled={!user || !documentId}
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
      
      <div className="flex justify-between items-center mt-4">
        <div className="flex space-x-2">
          <Button
            onClick={() => handleExport('docx')}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Export as DOCX
          </Button>
          <Button
            onClick={() => handleExport('pdf')}
            disabled={isLoading}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            Export as PDF
          </Button>
        </div>
        {!isSuperUser && remainingExports && (
          <div className="text-sm text-gray-600">
            {remainingExports.remaining} exports remaining
          </div>
        )}
      </div>
    </div>
  );
};

export default EditableMarkdown;
