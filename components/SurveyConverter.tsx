import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Upload, FileText, Database, Eye, Download, Wand2, ChevronLeft, BarChart } from 'lucide-react';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { saveAs } from 'file-saver';
import { v4 as uuidv4 } from 'uuid';
import api from '../lib/api';
import { Alert, AlertDescription } from "./ui/alert"
import { Progress } from "./ui/progress"

interface Question {
  id: string;
  text: string;
  type: 'text' | 'radio' | 'checkbox' | 'number' | 'select';
  options?: string[];
  section: string;
  description?: string;
}

interface Response {
  [key: string]: string | string[] | number;
}

interface FrequencyCount {
  questionId: string;
  questionText: string;
  counts: {
    [key: string]: number;
  };
}

interface SurveyConverterProps {
  onDataCollected?: (data: Response[]) => void;
  initialFile?: File | null;
}

const SurveyConverter: React.FC<SurveyConverterProps> = ({ onDataCollected, initialFile }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  const [currentResponse, setCurrentResponse] = useState<Response>({});
  const [sections, setSections] = useState<string[]>([]);
  const [currentSection, setCurrentSection] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rawDocumentText, setRawDocumentText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string>('');
  const [showFrequencyCounts, setShowFrequencyCounts] = useState(false);
  const [frequencyCounts, setFrequencyCounts] = useState<FrequencyCount[]>([]);

  // Process the initial file if provided
  useEffect(() => {
    if (initialFile) {
      processWordDocument(initialFile);
      setCurrentFileName(initialFile.name);
    }
  }, [initialFile]);

  // Process Word document using AI
  const processWordDocument = async (file: File) => {
    try {
      setError(null);
      setIsProcessing(true);
      setProcessingStatus('Reading document...');
      setProcessingProgress(10);

      // First, extract raw text from the document
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value;
      setRawDocumentText(text);
      setProcessingProgress(30);

      setProcessingStatus('Analyzing document structure...');

      // Use AI to analyze the document structure
      const response = await api.post('/api/analyze-survey', {
        documentText: text,
        systemPrompt: `You are an expert at analyzing survey documents. Your task is to:
        1. Extract the survey questions exactly as they appear in the document without changing their structure or wording
        2. Identify the most appropriate input type for each question (text, radio, checkbox, number, select)
        3. For multiple choice questions, extract the exact options as they appear in the document
        4. Group questions into logical sections if they exist in the document
        
        IMPORTANT: You must return ONLY a valid JSON object with NO markdown formatting, NO code blocks (like \`\`\`json), NO additional text before or after the JSON.
        
        The response should be a raw JSON object in the following format:
        {
          "sections": [
            {
              "title": "section title",
              "questions": [
                {
                  "id": "unique_id",
                  "text": "question text exactly as it appears in the document",
                  "type": "text|radio|checkbox|number|select",
                  "options": ["option1", "option2"] 
                }
              ]
            }
          ]
        }
        
        DO NOT include any explanations, markdown formatting, or code blocks in your response. Return ONLY the JSON object.`
      });

      setProcessingProgress(70);
      setProcessingStatus('Structuring survey form...');

      // Process AI response
      if (response.data.error) {
        throw new Error(response.data.error);
      }

      const analysisResult = response.data;
      
      // Validate the response structure
      if (!analysisResult.sections || !Array.isArray(analysisResult.sections)) {
        throw new Error('Invalid response format from AI. Missing sections array.');
      }

      const extractedSections: string[] = [];
      const extractedQuestions: Question[] = [];

      analysisResult.sections.forEach((section: any) => {
        extractedSections.push(section.title);
        
        section.questions.forEach((question: any) => {
          extractedQuestions.push({
            id: question.id,
            text: question.text,
            type: question.type,
            options: question.options,
            section: section.title,
            description: question.description
          });
        });
      });

      setSections(extractedSections);
      setQuestions(extractedQuestions);
      setProcessingProgress(100);
      setIsProcessing(false);
      setProcessingStatus('');
      setCurrentFileName(file.name);

    } catch (error: any) {
      console.error('Error processing document:', error);
      setProcessingStatus('');
      setIsProcessing(false);
      
      // Check if the error contains a raw response for debugging
      if (error.response?.data?.rawResponse) {
        setError(`Error processing document: ${error.message}. Raw API response: ${error.response.data.rawResponse.substring(0, 200)}...`);
      } else {
        setError(`Error processing document: ${error.message || 'Unknown error'}. Please try again or use a different file format.`);
      }
      
      setProcessingProgress(0);
    }
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processWordDocument(file);
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResponses([...responses, currentResponse]);
    setCurrentResponse({});
  };

  // Export to Excel
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    
    // Create worksheet from responses (raw data)
    const rawDataWs = XLSX.utils.json_to_sheet(responses);
    
    // Add raw data worksheet to workbook
    XLSX.utils.book_append_sheet(wb, rawDataWs, 'Raw Responses');
    
    // Create a properly formatted table for each question
    sections.forEach((sectionName, sectionIndex) => {
      // Create a new worksheet for each section
      const sectionData: any[] = [];
      
      // Add section title
      sectionData.push([`Section: ${sectionName}`]);
      sectionData.push([]);  // Empty row
      
      // Process each question in this section
      const sectionQuestions = questions.filter(q => q.section === sectionName);
      
      sectionQuestions.forEach((question, qIndex) => {
        // Add question text
        sectionData.push([`Question: ${question.text}`]);
        
        // Add table headers
        sectionData.push(['Answer', 'Frequency', 'Percentage']);
        
        if (question.type === 'radio' || question.type === 'select' || question.type === 'checkbox') {
          const questionCounts: {[key: string]: number} = {};
          let totalResponses = 0;
          
          // Initialize counts for all options
          if (question.options) {
            question.options.forEach(option => {
              questionCounts[option] = 0;
            });
          }
          
          // Count responses
          responses.forEach(response => {
            const answer = response[question.id];
            
            if (Array.isArray(answer) && answer.length > 0) {
              // Handle checkbox (multiple answers)
              answer.forEach(option => {
                questionCounts[option] = (questionCounts[option] || 0) + 1;
                totalResponses++;
              });
            } else if (answer) {
              // Handle radio/select (single answer)
              questionCounts[answer as string] = (questionCounts[answer as string] || 0) + 1;
              totalResponses++;
            }
          });
          
          // Add rows for each option with counts and percentages
          Object.entries(questionCounts).forEach(([option, count]) => {
            const percentage = totalResponses > 0 
              ? Math.round((count / totalResponses) * 100) 
              : 0;
            
            sectionData.push([option, count, `${percentage}%`]);
          });
          
          // Add total row
          sectionData.push(['Total', totalResponses, '100%']);
        } else {
          // For text/number questions
          let textResponseCount = 0;
          responses.forEach(response => {
            if (response[question.id]) {
              textResponseCount++;
            }
          });
          
          sectionData.push(['(Free text responses)', textResponseCount, '100%']);
        }
        
        // Add empty row for spacing between questions
        sectionData.push([]);
        sectionData.push([]);
      });
      
      // Create worksheet for this section
      const sectionWs = XLSX.utils.aoa_to_sheet(sectionData);
      
      // Set column widths for better readability
      const columnWidths = [
        { wch: 40 }, // Answer
        { wch: 15 }, // Frequency
        { wch: 15 }  // Percentage
      ];
      sectionWs['!cols'] = columnWidths;
      
      // Add section worksheet to workbook
      XLSX.utils.book_append_sheet(wb, sectionWs, sectionName.substring(0, 30)); // Excel has a 31 char limit for sheet names
    });
    
    // Create a summary worksheet with all questions
    const summaryData: any[] = [];
    
    // Add title
    summaryData.push(['Survey Summary']);
    summaryData.push([]);
    
    // Add header row
    summaryData.push(['Section', 'Question', 'Answer', 'Count', 'Percentage']);
    
    // Process all sections and questions
    sections.forEach(sectionName => {
      const sectionQuestions = questions.filter(q => q.section === sectionName);
      
      sectionQuestions.forEach(question => {
        let totalResponsesForQuestion = 0;
        const questionCounts: {[key: string]: number} = {};
        
        if (question.type === 'radio' || question.type === 'select' || question.type === 'checkbox') {
          // Initialize counts for all options
          if (question.options) {
            question.options.forEach(option => {
              questionCounts[option] = 0;
            });
          }
          
          // Count responses
          responses.forEach(response => {
            const answer = response[question.id];
            
            if (Array.isArray(answer)) {
              // Handle checkbox (multiple answers)
              answer.forEach(option => {
                questionCounts[option] = (questionCounts[option] || 0) + 1;
                totalResponsesForQuestion++;
              });
            } else if (answer) {
              // Handle radio/select (single answer)
              questionCounts[answer as string] = (questionCounts[answer as string] || 0) + 1;
              totalResponsesForQuestion++;
            }
          });
          
          // Add rows for each option with counts and percentages
          Object.entries(questionCounts).forEach(([option, count], index) => {
            const percentage = totalResponsesForQuestion > 0 
              ? Math.round((count / totalResponsesForQuestion) * 100) 
              : 0;
            
            summaryData.push([
              index === 0 ? sectionName : '',
              index === 0 ? question.text : '',
              option,
              count,
              `${percentage}%`
            ]);
          });
          
          // Add empty row for spacing
          summaryData.push([]);
        } else {
          // For text/number questions
          let textResponseCount = 0;
          responses.forEach(response => {
            if (response[question.id]) {
              textResponseCount++;
            }
          });
          
          summaryData.push([
            sectionName,
            question.text,
            '(Free text responses)',
            textResponseCount,
            textResponseCount > 0 ? '100%' : '0%'
          ]);
          
          // Add empty row for spacing
          summaryData.push([]);
        }
      });
    });
    
    // Create summary worksheet
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    
    // Set column widths for better readability
    const summaryColumnWidths = [
      { wch: 20 }, // Section
      { wch: 40 }, // Question
      { wch: 30 }, // Answer
      { wch: 15 }, // Count
      { wch: 15 }  // Percentage
    ];
    summaryWs['!cols'] = summaryColumnWidths;
    
    // Add summary worksheet to workbook
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Survey Summary');
    
    // Save workbook
    XLSX.writeFile(wb, 'survey_responses.xlsx');
  };

  // Calculate frequency counts for all questions
  const calculateFrequencyCounts = () => {
    if (responses.length === 0) return;

    const counts: FrequencyCount[] = [];

    // Process each question
    questions.forEach(question => {
      if (question.type === 'radio' || question.type === 'select' || question.type === 'checkbox') {
        const questionCounts: {[key: string]: number} = {};
        
        // Initialize counts for all options
        if (question.options) {
          question.options.forEach(option => {
            questionCounts[option] = 0;
          });
        }
        
        // Count responses
        responses.forEach(response => {
          const answer = response[question.id];
          
          if (Array.isArray(answer) && answer.length > 0) {
            // Handle checkbox (multiple answers)
            answer.forEach(option => {
              questionCounts[option] = (questionCounts[option] || 0) + 1;
            });
          } else if (answer) {
            // Handle radio/select (single answer)
            questionCounts[answer as string] = (questionCounts[answer as string] || 0) + 1;
          }
        });
        
        counts.push({
          questionId: question.id,
          questionText: question.text,
          counts: questionCounts
        });
      }
    });
    
    setFrequencyCounts(counts);
    setShowFrequencyCounts(true);
  };

  // Regenerate structure using AI
  const handleRegenerateStructure = async () => {
    if (!rawDocumentText) {
      setProcessingStatus('No document loaded. Please upload a document first.');
      return;
    }
    
    await processWordDocument(new File([rawDocumentText], 'document.txt', { type: 'text/plain' }));
  };

  // Handle response change for text, number, radio, and select inputs
  const handleResponseChange = (questionId: string, value: string | number) => {
    setCurrentResponse({
      ...currentResponse,
      [questionId]: value
    });
  };
  
  // Handle checkbox change
  const handleCheckboxChange = (questionId: string, option: string, checked: boolean) => {
    const currentValues = Array.isArray(currentResponse[questionId]) 
      ? currentResponse[questionId] as string[]
      : [];
    
    const newValues = checked
      ? [...currentValues, option]
      : currentValues.filter(v => v !== option);
    
    setCurrentResponse({
      ...currentResponse,
      [questionId]: newValues
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div className="flex items-center mb-3 sm:mb-0">
            <h2 className="text-lg font-medium">Survey Converter</h2>
            {currentFileName && (
              <span className="ml-2 text-sm text-gray-500 truncate max-w-[150px] sm:max-w-xs">
                - {currentFileName}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center"
              disabled={isProcessing}
            >
              <Upload className="h-4 w-4 mr-2" />
              <span className="whitespace-nowrap">Upload Survey</span>
            </Button>
            {questions.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerateStructure}
                className="flex items-center"
                disabled={isProcessing}
              >
                <Wand2 className="h-4 w-4 mr-2" />
                <span className="whitespace-nowrap">Regenerate</span>
              </Button>
            )}
            {responses.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowFrequencyCounts(false);
                    setShowPreview(!showPreview);
                  }}
                  className="flex items-center"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {showPreview ? 'Hide Data' : 'View Data'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowPreview(false);
                    calculateFrequencyCounts();
                  }}
                  className="flex items-center"
                >
                  <BarChart className="h-4 w-4 mr-2" />
                  <span className="whitespace-nowrap">Frequency</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToExcel}
                  className="flex items-center"
                >
                  <Download className="h-4 w-4 mr-2" />
                  <span className="whitespace-nowrap">Export</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* File input (hidden) */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
        accept=".docx,.doc,.txt"
      />

      {/* Processing status */}
      {isProcessing && (
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col items-center">
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
              <div 
                className="bg-blue-600 h-2.5 rounded-full" 
                style={{ width: `${processingProgress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600">{processingStatus}</p>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-4 border-b border-gray-200 bg-red-50">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Survey structure */}
      {questions.length > 0 && (
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-md font-medium mb-2">Survey Structure</h3>
          <div className="max-h-60 overflow-y-auto">
            {sections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-1">{section}</h4>
                <ul className="pl-4">
                  {questions
                    .filter(q => q.section === section)
                    .map((question, qIndex) => (
                      <li key={qIndex} className="text-sm text-gray-600 mb-1 truncate">
                        {question.text} 
                        <span className="text-xs text-gray-500 ml-1">
                          ({question.type}{question.options?.length ? `, ${question.options.length} options` : ''})
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Response form */}
      {questions.length > 0 && !showPreview && !showFrequencyCounts && (
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-md font-medium mb-2">Add Response</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {sections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">{section}</h4>
                <div className="space-y-4">
                  {questions
                    .filter(q => q.section === section)
                    .map((question, qIndex) => (
                      <div key={qIndex} className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {question.text}
                          {question.description && (
                            <span className="block text-xs text-gray-500 mt-0.5">{question.description}</span>
                          )}
                        </label>
                        
                        {question.type === 'text' && (
                          <input
                            type="text"
                            value={currentResponse[question.id] || ''}
                            onChange={(e) => handleResponseChange(question.id, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          />
                        )}
                        
                        {question.type === 'number' && (
                          <input
                            type="number"
                            value={currentResponse[question.id] || ''}
                            onChange={(e) => handleResponseChange(question.id, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          />
                        )}
                        
                        {question.type === 'radio' && question.options && (
                          <div className="space-y-2 mt-1">
                            {question.options.map((option, oIndex) => (
                              <div key={oIndex} className="flex items-center">
                                <input
                                  type="radio"
                                  id={`${question.id}-${oIndex}`}
                                  name={question.id}
                                  value={option}
                                  checked={currentResponse[question.id] === option}
                                  onChange={(e) => handleResponseChange(question.id, e.target.value)}
                                  className="h-4 w-4 text-blue-600 border-gray-300"
                                />
                                <label htmlFor={`${question.id}-${oIndex}`} className="ml-2 text-sm text-gray-700">
                                  {option}
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {question.type === 'checkbox' && question.options && (
                          <div className="space-y-2 mt-1">
                            {question.options.map((option, oIndex) => (
                              <div key={oIndex} className="flex items-center">
                                <input
                                  type="checkbox"
                                  id={`${question.id}-${oIndex}`}
                                  value={option}
                                  checked={Array.isArray(currentResponse[question.id]) && 
                                    (currentResponse[question.id] as string[]).includes(option)}
                                  onChange={(e) => handleCheckboxChange(question.id, option, e.target.checked)}
                                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                                />
                                <label htmlFor={`${question.id}-${oIndex}`} className="ml-2 text-sm text-gray-700">
                                  {option}
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {question.type === 'select' && question.options && (
                          <select
                            value={currentResponse[question.id] || ''}
                            onChange={(e) => handleResponseChange(question.id, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          >
                            <option value="">Select an option</option>
                            {question.options.map((option, oIndex) => (
                              <option key={oIndex} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ))}
            
            <div className="flex justify-end">
              <Button type="submit" className="flex items-center">
                <Database className="h-4 w-4 mr-2" />
                Add Response
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Response preview */}
      {showPreview && responses.length > 0 && (
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-md font-medium">Responses ({responses.length})</h3>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowPreview(false)}
              className="flex items-center"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>
          
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              <div className="overflow-hidden border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        #
                      </th>
                      {questions.map((question, qIndex) => (
                        <th 
                          key={qIndex} 
                          scope="col" 
                          className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          <div className="max-w-[150px] sm:max-w-xs truncate" title={question.text}>
                            {question.text}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {responses.map((response, rIndex) => (
                      <tr key={rIndex}>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                          {rIndex + 1}
                        </td>
                        {questions.map((question, qIndex) => (
                          <td key={qIndex} className="px-3 py-2 text-sm text-gray-500">
                            <div className="max-w-[150px] sm:max-w-xs overflow-hidden text-ellipsis">
                              {Array.isArray(response[question.id]) 
                                ? (response[question.id] as string[]).join(', ')
                                : response[question.id] || '-'}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Frequency counts */}
      {showFrequencyCounts && frequencyCounts.length > 0 && (
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-md font-medium">Frequency Counts</h3>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowFrequencyCounts(false)}
              className="flex items-center"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>
          
          <div className="space-y-6">
            {frequencyCounts.map((item, index) => (
              <div key={index} className="bg-gray-50 p-3 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">{item.questionText}</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                    <thead className="bg-gray-100">
                      <tr>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Option
                        </th>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Count
                        </th>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Percentage
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {Object.entries(item.counts).map(([option, count], oIndex) => {
                        const total = Object.values(item.counts).reduce((sum, c) => sum + c, 0);
                        const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                        
                        return (
                          <tr key={oIndex}>
                            <td className="px-3 py-2 text-sm text-gray-500">
                              <div className="max-w-[150px] sm:max-w-xs truncate">
                                {option}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-500">
                              {count}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-500">
                              {percentage}%
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-gray-50">
                        <td className="px-3 py-2 text-sm font-medium text-gray-700">
                          Total
                        </td>
                        <td className="px-3 py-2 text-sm font-medium text-gray-700">
                          {Object.values(item.counts).reduce((sum, count) => sum + count, 0)}
                        </td>
                        <td className="px-3 py-2 text-sm font-medium text-gray-700">
                          100%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No data state */}
      {!isProcessing && !error && questions.length === 0 && (
        <div className="p-8 flex flex-col items-center justify-center text-center">
          <FileText className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No survey loaded</h3>
          <p className="text-sm text-gray-500 mb-4 max-w-md">
            Upload a Word document (.docx) or text file (.txt) containing your survey questions to get started.
          </p>
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Survey
          </Button>
        </div>
      )}
    </div>
  );
};

export default SurveyConverter;