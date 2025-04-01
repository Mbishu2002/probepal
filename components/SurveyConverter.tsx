'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Upload, FileText, Database, Eye, Download, Wand2, ChevronLeft, BarChart } from 'lucide-react';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import axios from 'axios';
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
      const response = await axios.post('/api/analyze-survey', {
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
    
    // Process the current response to include any write-in text
    const processedResponse = { ...currentResponse };
    
    // For each question, check if there are any write-in fields
    questions.forEach(question => {
      if (question.options) {
        question.options.forEach(option => {
          const needsTextInput = option.endsWith('___') || 
                               option.toLowerCase().includes('specify') ||
                               option.toLowerCase().includes('other');
          
          if (needsTextInput) {
            const writeInKey = `${question.id}_${option}`;
            const writeInValue = currentResponse[writeInKey];
            
            // If this option is selected and has a write-in value
            if (question.type === 'radio' && currentResponse[question.id] === option && writeInValue) {
              // Replace the option with the option + write-in value
              processedResponse[question.id] = `${option}: ${writeInValue}`;
            } else if (question.type === 'checkbox') {
              const selectedOptions = (currentResponse[question.id] as string[]) || [];
              
              if (selectedOptions.includes(option) && writeInValue) {
                // For checkboxes, we need to modify the array
                const optionIndex = selectedOptions.indexOf(option);
                if (optionIndex !== -1) {
                  const newSelectedOptions = [...selectedOptions];
                  newSelectedOptions[optionIndex] = `${option}: ${writeInValue}`;
                  processedResponse[question.id] = newSelectedOptions;
                }
              }
            }
          }
        });
      }
    });
    
    setResponses([...responses, processedResponse]);
    setCurrentResponse({});
  };

  // Export to Excel
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    
    // Create a worksheet for raw responses
    const rawResponsesWs = XLSX.utils.json_to_sheet(
      responses.map((response, idx) => {
        const flatResponse: Record<string, string> = { ResponseID: `Response_${idx + 1}` };
        
        // Process each question
        questions.forEach(question => {
          const answer = response[question.id];
          
          // Handle different question types
          if (Array.isArray(answer)) {
            flatResponse[question.text] = answer.join(', ');
          } else if (answer !== undefined && answer !== null) {
            flatResponse[question.text] = String(answer);
          } else {
            flatResponse[question.text] = '';
          }
          
          // Include any write-in responses
          if (question.options) {
            question.options.forEach(option => {
              const needsTextInput = option.endsWith('___') || 
                                   option.toLowerCase().includes('specify') ||
                                   option.toLowerCase().includes('other');
              
              if (needsTextInput) {
                const writeInKey = `${question.id}_${option}`;
                const writeInValue = response[writeInKey];
                
                if (writeInValue) {
                  flatResponse[`${question.text} (${option})`] = String(writeInValue);
                }
              }
            });
          }
        });
        
        return flatResponse;
      })
    );
    
    XLSX.utils.book_append_sheet(wb, rawResponsesWs, 'Raw Responses');
    
    // Create a worksheet for each section
    const sectionWorksheets: Record<string, XLSX.WorkSheet> = {};
    
    sections.forEach(section => {
      const sectionQuestions = questions.filter(q => q.section === section);
      
      // Skip if no questions in this section
      if (sectionQuestions.length === 0) return;
      
      const sectionData: any[] = [];
      
      sectionQuestions.forEach(question => {
        // Get all possible options for this question
        let allOptions: string[] = [];
        
        if (question.options) {
          allOptions = [...question.options];
          
          // Add write-in responses as separate options
          question.options.forEach(option => {
            const needsTextInput = option.endsWith('___') || 
                                 option.toLowerCase().includes('specify') ||
                                 option.toLowerCase().includes('other');
            
            if (needsTextInput) {
              responses.forEach(response => {
                const writeInKey = `${question.id}_${option}`;
                const writeInValue = response[writeInKey];
                
                if (writeInValue && typeof writeInValue === 'string') {
                  const fullOption = `${option}: ${writeInValue}`;
                  if (!allOptions.includes(fullOption)) {
                    allOptions.push(fullOption);
                  }
                }
              });
            }
          });
        }
        
        // Count frequencies
        const questionCounts: Record<string, number> = {};
        let totalResponses = 0;
        
        responses.forEach(response => {
          const answer = response[question.id];
          
          if (Array.isArray(answer)) {
            // Handle checkbox (multiple answers)
            answer.forEach(option => {
              questionCounts[option] = (questionCounts[option] || 0) + 1;
              totalResponses++;
            });
          } else if (answer !== undefined && answer !== null && answer !== '') {
            // Handle radio/select/text/number (single answer)
            questionCounts[String(answer)] = (questionCounts[String(answer)] || 0) + 1;
            totalResponses++;
          }
          
          // Include write-in responses in the counts
          if (question.options) {
            question.options.forEach(option => {
              const needsTextInput = option.endsWith('___') || 
                                   option.toLowerCase().includes('specify') ||
                                   option.toLowerCase().includes('other');
              
              if (needsTextInput) {
                const writeInKey = `${question.id}_${option}`;
                const writeInValue = response[writeInKey];
                
                if (writeInValue) {
                  const fullOption = `${option}: ${writeInValue}`;
                  // Only count if not already counted in the main answer
                  if (!answer || (Array.isArray(answer) && !answer.includes(fullOption)) || 
                      (!Array.isArray(answer) && answer !== fullOption)) {
                    questionCounts[fullOption] = (questionCounts[fullOption] || 0) + 1;
                    // Don't increment totalResponses as this is part of an existing response
                  }
                }
              }
            });
          }
        });
        
        // Calculate percentages and create data rows
        if (totalResponses > 0) {
          // For questions with predefined options
          if (allOptions.length > 0) {
            allOptions.forEach(option => {
              const count = questionCounts[option] || 0;
              const percentage = totalResponses > 0 ? (count / totalResponses) * 100 : 0;
              
              sectionData.push({
                'Question': question.text,
                'Answer': option,
                'Count': count,
                'Percentage': percentage.toFixed(2) + '%'
              });
            });
          } else {
            // For free text questions, list each unique answer
            Object.keys(questionCounts).forEach(answer => {
              const count = questionCounts[answer];
              const percentage = (count / totalResponses) * 100;
              
              sectionData.push({
                'Question': question.text,
                'Answer': answer,
                'Count': count,
                'Percentage': percentage.toFixed(2) + '%'
              });
            });
          }
        } else {
          // No responses for this question
          sectionData.push({
            'Question': question.text,
            'Answer': 'No responses',
            'Count': 0,
            'Percentage': '0.00%'
          });
        }
      });
      
      // Create worksheet for this section
      if (sectionData.length > 0) {
        const ws = XLSX.utils.json_to_sheet(sectionData);
        sectionWorksheets[section] = ws;
        XLSX.utils.book_append_sheet(wb, ws, section.substring(0, 31)); // Excel sheet names limited to 31 chars
      }
    });
    
    // Create a summary worksheet
    const summaryData: any[] = [];
    
    questions.forEach(question => {
      // Get all possible options for this question
      let allOptions: string[] = [];
      
      if (question.options) {
        allOptions = [...question.options];
        
        // Add write-in responses as separate options
        question.options.forEach(option => {
          const needsTextInput = option.endsWith('___') || 
                               option.toLowerCase().includes('specify') ||
                               option.toLowerCase().includes('other');
          
          if (needsTextInput) {
            responses.forEach(response => {
              const writeInKey = `${question.id}_${option}`;
              const writeInValue = response[writeInKey];
              
              if (writeInValue && typeof writeInValue === 'string') {
                const fullOption = `${option}: ${writeInValue}`;
                if (!allOptions.includes(fullOption)) {
                  allOptions.push(fullOption);
                }
              }
            });
          }
        });
      }
      
      // Count frequencies
      const questionCounts: Record<string, number> = {};
      let totalResponses = 0;
      
      responses.forEach(response => {
        const answer = response[question.id];
        
        if (Array.isArray(answer)) {
          // Handle checkbox (multiple answers)
          answer.forEach(option => {
            questionCounts[option] = (questionCounts[option] || 0) + 1;
            totalResponses++;
          });
        } else if (answer !== undefined && answer !== null && answer !== '') {
          // Handle radio/select/text/number (single answer)
          questionCounts[String(answer)] = (questionCounts[String(answer)] || 0) + 1;
          totalResponses++;
        }
        
        // Include write-in responses in the counts
        if (question.options) {
          question.options.forEach(option => {
            const needsTextInput = option.endsWith('___') || 
                                 option.toLowerCase().includes('specify') ||
                                 option.toLowerCase().includes('other');
            
            if (needsTextInput) {
              const writeInKey = `${question.id}_${option}`;
              const writeInValue = response[writeInKey];
              
              if (writeInValue) {
                const fullOption = `${option}: ${writeInValue}`;
                // Only count if not already counted in the main answer
                if (!answer || (Array.isArray(answer) && !answer.includes(fullOption)) || 
                    (!Array.isArray(answer) && answer !== fullOption)) {
                  questionCounts[fullOption] = (questionCounts[fullOption] || 0) + 1;
                  // Don't increment totalResponses as this is part of an existing response
                }
              }
            }
          });
        }
      });
      
      // Calculate percentages and create data rows
      if (totalResponses > 0) {
        // For questions with predefined options
        if (allOptions.length > 0) {
          allOptions.forEach(option => {
            const count = questionCounts[option] || 0;
            const percentage = totalResponses > 0 ? (count / totalResponses) * 100 : 0;
            
            summaryData.push({
              'Section': question.section,
              'Question': question.text,
              'Answer': option,
              'Count': count,
              'Percentage': percentage.toFixed(2) + '%'
            });
          });
        } else {
          // For free text questions, list each unique answer
          Object.keys(questionCounts).forEach(answer => {
            const count = questionCounts[answer];
            const percentage = (count / totalResponses) * 100;
            
            summaryData.push({
              'Section': question.section,
              'Question': question.text,
              'Answer': answer,
              'Count': count,
              'Percentage': percentage.toFixed(2) + '%'
            });
          });
        }
      } else {
        // No responses for this question
        summaryData.push({
          'Section': question.section,
          'Question': question.text,
          'Answer': 'No responses',
          'Count': 0,
          'Percentage': '0.00%'
        });
      }
    });
    
    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Survey Summary');
    
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
          
          if (Array.isArray(answer)) {
            // Handle checkbox (multiple answers)
            answer.forEach(option => {
              questionCounts[option] = (questionCounts[option] || 0) + 1;
            });
          } else if (answer) {
            // Handle radio/select (single answer)
            questionCounts[answer as string] = (questionCounts[answer as string] || 0) + 1;
          }
          
          // Include write-in responses in the counts
          if (question.options) {
            question.options.forEach(option => {
              const needsTextInput = option.endsWith('___') || 
                                   option.toLowerCase().includes('specify') ||
                                   option.toLowerCase().includes('other');
              
              if (needsTextInput) {
                const writeInKey = `${question.id}_${option}`;
                const writeInValue = response[writeInKey];
                
                if (writeInValue) {
                  const fullOption = `${option}: ${writeInValue}`;
                  questionCounts[fullOption] = (questionCounts[fullOption] || 0) + 1;
                }
              }
            });
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

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
          <div className="flex items-center">
            <h2 className="text-lg font-medium">Survey Converter</h2>
            {currentFileName && (
              <span className="ml-2 text-sm text-gray-500 truncate max-w-[200px]">
                - {currentFileName}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center"
              disabled={isProcessing}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Survey
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
                Regenerate
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
                  Frequency Counts
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToExcel}
                  className="flex items-center"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".docx"
        className="hidden"
      />

      {isProcessing && (
        <div className="p-4">
          <Alert className="mb-4">
            <AlertDescription>
              <div className="flex flex-col space-y-2">
                <div className="flex justify-between items-center">
                  <span>{processingStatus}</span>
                  <span className="text-sm text-gray-500">{processingProgress}%</span>
                </div>
                <Progress value={processingProgress} className="h-2" />
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {error && (
        <div className="p-4">
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="p-4">
        {questions.length === 0 && !isProcessing && !error ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">No Survey Loaded</h3>
            <p className="text-gray-600 mb-4">Upload a document to get started</p>
            <Button 
              onClick={() => fileInputRef.current?.click()}
              className="mx-auto"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </div>
        ) : showFrequencyCounts ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Frequency Counts</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowFrequencyCounts(false)}
                className="text-gray-500"
              >
                Back to Survey
              </Button>
            </div>
            
            {frequencyCounts.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-500">No data available for frequency counts.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {frequencyCounts.map((item, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <h4 className="font-medium mb-3">{item.questionText}</h4>
                    <div className="space-y-2">
                      {Object.entries(item.counts).map(([option, count], idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-sm">{option}</span>
                          <div className="flex items-center">
                            <div className="w-48 bg-gray-200 rounded-full h-2.5 mr-2">
                              <div 
                                className="bg-blue-600 h-2.5 rounded-full" 
                                style={{ 
                                  width: `${Math.round((count / responses.length) * 100)}%` 
                                }}
                              ></div>
                            </div>
                            <span className="text-sm text-gray-500">
                              {count} ({Math.round((count / responses.length) * 100)}%)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : showPreview ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {questions.map(q => (
                    <th
                      key={q.id}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {q.text}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {responses.map((response, idx) => (
                  <tr key={idx}>
                    {questions.map(q => (
                      <td key={q.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {Array.isArray(response[q.id]) 
                          ? (response[q.id] as string[]).join(', ')
                          : String(response[q.id] || '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {sections.map(section => (
              <div key={section} className="border rounded-lg p-4">
                <h3 className="text-lg font-medium mb-4">{section}</h3>
                <div className="space-y-4">
                  {questions
                    .filter(q => q.section === section)
                    .map(question => (
                      <div key={question.id} className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          {question.text}
                          {question.description && (
                            <span className="text-sm text-gray-500 ml-2">
                              ({question.description})
                            </span>
                          )}
                        </label>
                        {question.type === 'radio' && question.options && (
                          <div className="space-y-2">
                            {question.options.map((option, idx) => {
                              // Check if this option requires a text input (ends with ___ or contains 'specify')
                              const needsTextInput = option.endsWith('___') || 
                                                    option.toLowerCase().includes('specify') ||
                                                    option.toLowerCase().includes('other');
                              
                              return (
                                <div key={idx} className="flex flex-col space-y-1">
                                  <label className="flex items-center space-x-2">
                                    <input
                                      type="radio"
                                      name={question.id}
                                      value={option}
                                      onChange={e => {
                                        const newResponse = {
                                          ...currentResponse,
                                          [question.id]: e.target.value
                                        };
                                        
                                        // Reset all text inputs for this question
                                        question.options?.forEach(opt => {
                                          if (opt.endsWith('___') || opt.toLowerCase().includes('specify') || opt.toLowerCase().includes('other')) {
                                            delete newResponse[`${question.id}_${opt}`];
                                          }
                                        });
                                        
                                        setCurrentResponse(newResponse);
                                      }}
                                      checked={currentResponse[question.id] === option}
                                      className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
                                    />
                                    <span className="text-sm text-gray-700">{option}</span>
                                  </label>
                                  
                                  {/* Show text input if this option is selected and needs text input */}
                                  {needsTextInput && currentResponse[question.id] === option && (
                                    <div className="ml-6">
                                      <input
                                        type="text"
                                        placeholder="Please specify..."
                                        value={String(currentResponse[`${question.id}_${option}`] || '')}
                                        onChange={e => 
                                          setCurrentResponse({
                                            ...currentResponse,
                                            [`${question.id}_${option}`]: e.target.value
                                          })
                                        }
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {question.type === 'checkbox' && question.options && (
                          <div className="space-y-2">
                            {question.options.map((option, idx) => {
                              // Check if this option requires a text input (ends with ___ or contains 'specify')
                              const needsTextInput = option.endsWith('___') || 
                                                    option.toLowerCase().includes('specify') ||
                                                    option.toLowerCase().includes('other');
                              
                              // Check if this option is selected
                              const isSelected = (currentResponse[question.id] as string[] || []).includes(option);
                              
                              return (
                                <div key={idx} className="flex flex-col space-y-1">
                                  <label className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      value={option}
                                      onChange={e => {
                                        const currentValues = (currentResponse[question.id] as string[]) || [];
                                        const newValues = e.target.checked
                                          ? [...currentValues, option]
                                          : currentValues.filter(v => v !== option);
                                        
                                        const newResponse = {
                                          ...currentResponse,
                                          [question.id]: newValues
                                        };
                                        
                                        // If unchecking, remove the text input value
                                        if (!e.target.checked && needsTextInput) {
                                          delete newResponse[`${question.id}_${option}`];
                                        }
                                        
                                        setCurrentResponse(newResponse);
                                      }}
                                      checked={isSelected}
                                      className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                                    />
                                    <span className="text-sm text-gray-700">{option}</span>
                                  </label>
                                  
                                  {/* Show text input if this option is selected and needs text input */}
                                  {needsTextInput && isSelected && (
                                    <div className="ml-6">
                                      <input
                                        type="text"
                                        placeholder="Please specify..."
                                        value={String(currentResponse[`${question.id}_${option}`] || '')}
                                        onChange={e => 
                                          setCurrentResponse({
                                            ...currentResponse,
                                            [`${question.id}_${option}`]: e.target.value
                                          })
                                        }
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {question.type === 'text' && (
                          <input
                            type="text"
                            value={String(currentResponse[question.id] || '')}
                            onChange={e =>
                              setCurrentResponse({
                                ...currentResponse,
                                [question.id]: e.target.value
                              })
                            }
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
                        )}
                        {question.type === 'number' && (
                          <input
                            type="number"
                            value={String(currentResponse[question.id] || '')}
                            onChange={e =>
                              setCurrentResponse({
                                ...currentResponse,
                                [question.id]: Number(e.target.value)
                              })
                            }
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
                        )}
                        {question.type === 'select' && question.options && (
                          <select
                            value={String(currentResponse[question.id] || '')}
                            onChange={e =>
                              setCurrentResponse({
                                ...currentResponse,
                                [question.id]: e.target.value
                              })
                            }
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          >
                            <option value="">Select an option</option>
                            {question.options.map((option, idx) => (
                              <option key={idx} value={option}>
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
            {sections.length > 0 && (
              <div className="flex justify-end">
                <Button type="submit" className="flex items-center">
                  <Database className="h-4 w-4 mr-2" />
                  Save Response
                </Button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

export default SurveyConverter;