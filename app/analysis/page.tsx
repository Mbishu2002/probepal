'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import EditableMarkdown from '@/components/EditableMarkdown';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Menu } from 'lucide-react';
import { getRemainingExports } from '@/lib/subscription';
import { supabase } from '@/lib/supabase';
import UserDropdown from '@/components/ui/UserDropdown';
import * as XLSX from 'xlsx';
import { useSubscription } from '@/contexts/SubscriptionContext';

interface FileItem {
  id: string;
  name: string;
  data: any[];
}

export default function AnalysisPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { remainingExports, isUnlimited, trackDocumentExport } = useSubscription();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>('Google Gemini 2.0 Flash');
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [showSidebar, setShowSidebar] = useState<boolean>(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [isSuperUser, setIsSuperUser] = useState<boolean>(false);

  // Fetch system prompt on component mount
  useEffect(() => {
    const fetchSystemPrompt = async () => {
      try {
        const response = await fetch('/api/system-prompt');
        const data = await response.json();
        console.log('System prompt response:', data);
        setSystemPrompt(data.prompt);
      } catch (error) {
        console.error('Error fetching system prompt:', error);
      }
    };

    fetchSystemPrompt();
  }, []);

  // Handle file from URL
  useEffect(() => {
    const handleFileFromUrl = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const fileUrl = searchParams.get('file');
      
      if (fileUrl) {
        try {
          const response = await fetch(decodeURIComponent(fileUrl));
          const blob = await response.blob();
          const file = new File([blob], 'uploaded_file.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          
          // Process the Excel file
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const ab = e.target?.result;
              const wb = XLSX.read(ab, { type: 'array' });
              const wsname = wb.SheetNames[0];
              const ws = wb.Sheets[wsname];
              const jsonData = XLSX.utils.sheet_to_json(ws);
              
              const fileItem: FileItem = {
                id: Date.now().toString(),
                name: file.name,
                data: jsonData
              };
              
              setFiles([fileItem]);
              setActiveFileId(fileItem.id);
            } catch (error) {
              console.error('Error parsing Excel file:', error);
            }
          };
          reader.readAsArrayBuffer(file);
        } catch (error) {
          console.error('Error processing file from URL:', error);
        }
      }
    };

    handleFileFromUrl();
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchRemainingExports = async () => {
      if (user) {
        try {
          const exports = await getRemainingExports(user.id);
          // No need to set remainingExports as it's managed by the context
        } catch (error) {
          console.error('Error fetching remaining exports:', error);
        }
      }
    };
    fetchRemainingExports();
  }, [user]);

  useEffect(() => {
    const checkSuperUser = async () => {
      if (user) {
        try {
          const { data: { user: supabaseUser } } = await supabase.auth.getUser();
          if (supabaseUser?.email === 'mbishu@example.com') {
            setIsSuperUser(true);
          }
        } catch (error) {
          console.error('Error checking super user:', error);
        }
      }
    };
    checkSuperUser();
  }, [user]);

  const handleFileSelect = (fileId: string) => {
    setActiveFileId(fileId);
    if (window.innerWidth < 768) {
      setMobileSidebarOpen(false);
    }
  };

  const handleAddFile = async (file: File) => {
    if (!user) return;

    try {
      // Create a URL for the file
      const fileUrl = URL.createObjectURL(file);
      
      // Process the Excel file
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const ab = e.target?.result;
          const wb = XLSX.read(ab, { type: 'array' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const jsonData = XLSX.utils.sheet_to_json(ws);
          
          const fileItem: FileItem = {
            id: Date.now().toString(),
            name: file.name,
            data: jsonData
          };
          
          setFiles(prev => [...prev, fileItem]);
          setActiveFileId(fileItem.id);
        } catch (error) {
          console.error('Error parsing Excel file:', error);
          alert('Error parsing Excel file. Please try again.');
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error processing file:', error);
      alert('Error processing file. Please try again.');
    }
  };

  const handleRemoveFile = async (fileId: string) => {
    if (!user) return;

    try {
      // Delete file from storage
      await supabase.storage
        .from('documents')
        .remove([`${user.id}/${fileId}`]);

      // Delete document record
      await supabase
        .from('documents')
        .delete()
        .eq('id', fileId);

      // Update local state
      setFiles(prev => prev.filter(f => f.id !== fileId));
      if (activeFileId === fileId) {
        setActiveFileId(null);
      }
    } catch (error) {
      console.error('Error removing file:', error);
    }
  };

  const handleGenerate = async (analysisStyle: string) => {
    if (!user || !activeFileId) return;

    try {
      setIsGenerating(true);
      
      // Track the export
      const canExport = await trackDocumentExport(activeFileId);
      if (!canExport) {
        alert('You have no exports remaining. Please upgrade your plan.');
        return;
      }

      // Get the active file data
      const activeFile = files.find(f => f.id === activeFileId);
      if (!activeFile) {
        throw new Error('Active file not found');
      }

      // Call the generate API
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          systemPrompt,
          data: activeFile.data,
          analysisStyle
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate analysis');
      }

      const result = await response.json();
      setGeneratedContent(result.content);
      
    } catch (error) {
      console.error('Error generating analysis:', error);
      alert('Failed to generate analysis. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
  };

  const toggleMobileSidebar = () => {
    setMobileSidebarOpen(!mobileSidebarOpen);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/')}
              className="text-gray-600 hover:text-gray-900 flex items-center"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Home
            </Button>
            <div className="flex items-center gap-4">
              {showSidebar && (
                <div className="md:hidden">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="bg-white hover:bg-gray-50" 
                    onClick={toggleMobileSidebar}
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </div>
              )}
              <UserDropdown />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="relative flex flex-col md:flex-row gap-6">
          <div className={`
            fixed inset-y-0 left-0 z-10 w-64 transition-all duration-300 bg-white/90 backdrop-blur-sm shadow-lg
            ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}>
            <div className="h-full">
              <Sidebar 
                files={files}
                activeFileId={activeFileId}
                onFileSelect={handleFileSelect}
                onAddFile={handleAddFile}
                onRemoveFile={handleRemoveFile}
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
                onModelChange={handleModelChange}
              />
            </div>
          </div>
          
          {mobileSidebarOpen && (
            <div 
              className="fixed inset-0 bg-black/50 z-[5] md:hidden" 
              onClick={() => setMobileSidebarOpen(false)}
            />
          )}
          
          <div className="flex-1 overflow-auto md:ml-64 transition-all duration-300">
            <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-6 border border-gray-100">
              {generatedContent ? (
                <div className="prose max-w-none">
                  <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span>Analysis Complete</span>
                  </div>
                  <EditableMarkdown 
                    content={generatedContent} 
                    isLoading={isGenerating}
                    documentId={activeFileId || undefined}
                    isSuperUser={isSuperUser}
                    onExport={trackDocumentExport}
                  />
                </div>
              ) : isGenerating ? (
                <div className="flex flex-col items-center justify-center min-h-[400px]">
                  <div className="text-center max-w-md">
                    <div className="relative mb-8">
                      <div className="w-16 h-16 border-4 border-blue-100 rounded-full"></div>
                      <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-500 rounded-full animate-spin border-t-transparent"></div>
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold mb-4 text-gray-900">Generating Analysis</h2>
                    <p className="text-gray-600 mb-4">
                      Please wait while we analyze your data...
                    </p>
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                      <span>Processing your request</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[400px]">
                  <div className="text-center max-w-md">
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6 mx-auto">
                      <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold mb-4 text-gray-900">Ready to Analyze</h2>
                    <p className="text-gray-600 mb-6">
                      Select a file from the sidebar to analyze.
                    </p>
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                      <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                      <span>Waiting for file selection</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}