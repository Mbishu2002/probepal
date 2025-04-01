'use client';

import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import api from '../lib/api';
import { read, utils } from 'xlsx';
import LandingPage from '@/components/LandingPage';
import Sidebar from '@/components/Sidebar';
import EditableMarkdown from '@/components/EditableMarkdown';
import { Menu, File, BarChart, ClipboardList, ChevronLeft, Database, Microscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import SurveyConverter from '@/components/SurveyConverter';
import SurveyLandingPage from '@/components/SurveyLandingPage';
import PricingPlans from '@/components/PricingPlans';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getRemainingExports } from '@/lib/subscription';
import { supabase } from '@/lib/supabase';

interface FileItem {
  id: string;
  name: string;
  data: any[];
}

interface Subscription {
  plan: string;
  documentsRemaining: number;
  expiryDate: Date;
}

export default function Home() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>('Google Gemini 2.0 Flash');
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [showSidebar, setShowSidebar] = useState<boolean>(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('analysis');
  const [surveyFile, setSurveyFile] = useState<File | null>(null);
  const [showSurveyConverter, setShowSurveyConverter] = useState<boolean>(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [showPricing, setShowPricing] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState(false);
  const [remainingExports, setRemainingExports] = useState<{ remaining: number; plan: string } | null>(null);
  const [isSuperUser, setIsSuperUser] = useState<boolean>(false);

  useEffect(() => {
    if (!loading && !user) {
      // Show landing page for unauthenticated users
      return;
    }
  }, [loading, user]);

  // Fetch system prompt on component mount
  useEffect(() => {
    const fetchSystemPrompt = async () => {
      try {
        const response = await api.get('/api/system-prompt');
        console.log('System prompt response:', response.data);
        setSystemPrompt(response.data.prompt);
      } catch (error) {
        console.error('Error fetching system prompt:', error);
      }
    };

    fetchSystemPrompt();
  }, []);

  // Close mobile sidebar on window resize if screen becomes larger
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Add this useEffect to fetch remaining exports
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

  // Add this useEffect to check super user status
  useEffect(() => {
    const checkSuperUser = async () => {
      if (user) {
        try {
          const { data: userData } = await supabase
            .from('users')
            .select('email')
            .eq('id', user.id)
            .single();
          
          setIsSuperUser(userData?.email === 'fmbishu@gmail.com');
        } catch (error) {
          console.error('Error checking super user status:', error);
        }
      }
    };

    checkSuperUser();
  }, [user]);

  const handleFileUpload = async (file: File) => {
    if (!user) {
      // Instead of redirecting, show the landing page
      return;
    }
    setIsUploading(true);
    // Handle file upload logic here
    setIsUploading(false);
  };

  const handleAddFile = (file: File) => {
    handleFileUpload(file);
  };

  const handleAddFileWrapper = () => {
    // Create a hidden file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleAddFile(file);
      }
    };
    input.click();
  };

  const handleSurveyFileUpload = (file: File) => {
    setSurveyFile(file);
    setShowSurveyConverter(true);
  };

  const handleRemoveFile = (fileId: string) => {
    setFiles(prevFiles => prevFiles.filter(file => file.id !== fileId));
    
    // If the active file is removed, set the active file to the first file in the list
    if (activeFileId === fileId) {
      setActiveFileId(() => {
        const remainingFiles = files.filter(file => file.id !== fileId);
        return remainingFiles.length > 0 ? remainingFiles[0].id : null;
      });
      
      // Clear generated content if no files remain
      if (files.length <= 1) {
        setGeneratedContent('');
      }
    }
    
    // Hide sidebar if no files remain
    if (files.length <= 1) {
      setShowSidebar(false);
    }
  };

  const handleFileSelect = (fileId: string) => {
    setActiveFileId(fileId);
    // Close mobile sidebar after selection on small screens
    if (window.innerWidth < 768) {
      setMobileSidebarOpen(false);
    }
  };

  const handleGenerate = async () => {
    if (!activeFileId) return;
    
    const activeFile = files.find(file => file.id === activeFileId);
    if (!activeFile || !activeFile.data.length) return;

    setIsGenerating(true);

    try {
      const jsonData = activeFile.data.slice(0, 100); // Limit to first 100 rows for performance
      const response = await api.post('/api/generate', {
        data: jsonData,
        model: selectedModel,
        systemPrompt
      });
      
      setGeneratedContent(response.data.content);
      
      // Only decrement document count if not on free plan
      if (subscription && subscription.plan !== "Free") {
        setSubscription(prev => prev ? {
          ...prev,
          documentsRemaining: prev.documentsRemaining - 1
        } : null);
      }
      
      // Close mobile sidebar after generating content on small screens
      if (window.innerWidth < 768) {
        setMobileSidebarOpen(false);
      }
    } catch (error) {
      console.error('Error generating content:', error);
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

  const handleTabChange = (value: string) => {
    // If switching to analysis mode and we have analysis data, ensure sidebar is visible
    if (value === 'analysis' && activeFileId) {
      setShowSidebar(true);
      // Close mobile sidebar on small screens for clean layout
      setMobileSidebarOpen(window.innerWidth >= 768);
    }
    
    // Reset survey converter state when switching to survey tab
    if (value === 'survey') {
      setShowSurveyConverter(false);
      setSurveyFile(null);
    }
    
    setActiveTab(value);
  };

  const handleBackToSurveyLanding = () => {
    setShowSurveyConverter(false);
    setSurveyFile(null);
  };

  const handleRemoveSurveyFile = () => {
    setSurveyFile(null);
    setShowSurveyConverter(false);
  };

  const handleSelectPlan = async (plan: any) => {
    try {
      // For free plan, just set the subscription without any API call
      if (plan.name === "Free") {
        const newSubscription: Subscription = {
          plan: plan.name,
          documentsRemaining: 0,
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
        };
        setSubscription(newSubscription);
        setShowPricing(false);
        return;
      }

      // Here you would integrate with your payment processor (e.g., Stripe)
      // For now, we'll just simulate a successful subscription
      const newSubscription: Subscription = {
        plan: plan.name,
        documentsRemaining: plan.documents,
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      };
      
      setSubscription(newSubscription);
      setShowPricing(false);
      
      // You would typically make an API call here to create the subscription
      // await api.post('/api/subscriptions', { plan: plan.name });
    } catch (error) {
      console.error('Error creating subscription:', error);
    }
  };

  // Add this function to handle document exports
  const handleExport = async (documentId: string) => {
    if (!user) return;

    try {
      const response = await fetch('/api/documents/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId,
          userId: user.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to export document');
      }

      const exportData = await response.json();
      
      // Update remaining exports count
      if (remainingExports) {
        setRemainingExports({
          ...remainingExports,
          remaining: remainingExports.remaining - 1
        });
      }

      // Create a download link for the exported data
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export-${documentId}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (error: any) {
      console.error('Error exporting document:', error);
      // Show error message to user
      alert(error.message || 'Failed to export document');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage onFileUpload={handleFileUpload} />;
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 flex items-center">
            <Microscope className="h-6 w-6 mr-2 text-blue-600" />
            ProbePal
          </h1>
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPricing(true)}
              className="text-gray-600 hover:text-blue-600"
            >
              Pricing
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut()}
              className="text-gray-600 hover:text-blue-600"
            >
              Sign Out
            </Button>
            {/* Mobile sidebar toggle button */}
            {showSidebar && (
              <div className="md:hidden">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-white" 
                  onClick={toggleMobileSidebar}
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </div>
            )}
          </div>
        </div>
        
        {showPricing ? (
          <PricingPlans onSelectPlan={handleSelectPlan} />
        ) : (
          <Tabs 
            defaultValue="analysis" 
            className="w-full"
            value={activeTab}
            onValueChange={handleTabChange}
          >
            <div className="border-b border-gray-200 mb-6 overflow-x-auto">
              <TabsList className="w-full flex rounded-none bg-transparent p-0 mb-0 min-w-max">
                <TabsTrigger 
                  value="analysis" 
                  className={`flex items-center justify-center py-2 md:py-3 px-4 md:px-6 text-sm md:text-base font-medium border-b-2 transition-all duration-200 ease-in-out ${
                    activeTab === 'analysis' 
                      ? 'border-blue-600 text-blue-600' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <BarChart className="h-4 w-4 mr-1 md:mr-2" />
                  <span className="whitespace-nowrap">Analysis & Charts</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="survey" 
                  className={`flex items-center justify-center py-2 md:py-3 px-4 md:px-6 text-sm md:text-base font-medium border-b-2 transition-all duration-200 ease-in-out ${
                    activeTab === 'survey' 
                      ? 'border-blue-600 text-blue-600' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <ClipboardList className="h-4 w-4 mr-1 md:mr-2" />
                  <span className="whitespace-nowrap">Survey Data</span>
                </TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="analysis" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
              {!showSidebar ? (
                <LandingPage onFileUpload={handleAddFileWrapper} />
              ) : (
                <div className="relative flex flex-col md:flex-row h-screen overflow-hidden">
                  {/* Static sidebar for analysis mode */}
                  <div className={`
                    fixed inset-y-0 left-0 z-10 w-64 transition-all duration-300
                    ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                  `}>
                    <div className="h-full">
                      <Sidebar 
                        files={files}
                        activeFileId={activeFileId}
                        onFileSelect={handleFileSelect}
                        onAddFile={handleAddFileWrapper}
                        onRemoveFile={handleRemoveFile}
                        onGenerate={handleGenerate}
                        isGenerating={isGenerating}
                        onModelChange={handleModelChange}
                      />
                    </div>
                  </div>
                  
                  {/* Overlay for mobile sidebar */}
                  {mobileSidebarOpen && (
                    <div 
                      className="fixed inset-0 bg-black/50 z-[5] md:hidden" 
                      onClick={() => setMobileSidebarOpen(false)}
                    />
                  )}
                  
                  {/* Main content area with proper spacing for sidebar */}
                  <div className="flex-1 overflow-auto md:ml-64 transition-all duration-300">
                    <div className="p-4 md:p-6">
                      {subscription && (
                        <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                          <div className="flex justify-between items-center">
                            <div>
                              <h3 className="text-sm font-medium text-blue-800">
                                {subscription.plan} Plan
                              </h3>
                              {subscription.plan !== "Free" && (
                                <p className="text-sm text-blue-600">
                                  {remainingExports?.remaining || 0} exports remaining
                                </p>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowPricing(true)}
                            >
                              {subscription.plan === "Free" ? "Upgrade" : "Upgrade Plan"}
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {generatedContent ? (
                        <div>
                          <EditableMarkdown 
                            content={generatedContent} 
                            isLoading={isGenerating}
                            documentId={activeFileId || undefined}
                            isSuperUser={isSuperUser}
                          />
                          {subscription?.plan !== "Free" && !isSuperUser && (
                            <div className="mt-4 flex justify-between items-center">
                              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <p className="text-sm text-yellow-800">
                                  {remainingExports?.remaining || 0} exports remaining
                                </p>
                              </div>
                              <Button
                                onClick={() => handleExport(activeFileId!)}
                                disabled={!remainingExports?.remaining}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                Export Analysis
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : isGenerating ? (
                        <div className="flex flex-col items-center justify-center h-full">
                          <div className="text-center max-w-md">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4 mx-auto"></div>
                            <h2 className="text-xl md:text-2xl font-bold mb-4">Generating Analysis</h2>
                            <p className="text-gray-600">
                              Please wait while we analyze your data...
                            </p>
                            <p className="text-sm text-gray-500 mt-4">
                              This may take a moment depending on the size and complexity of your dataset.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full">
                          <div className="text-center max-w-md">
                            <h2 className="text-xl md:text-2xl font-bold mb-4">Ready to Analyze</h2>
                            
                            {activeFileId && (
                              <div className="mb-4">
                                <div className="bg-white p-3 rounded-md border border-gray-200 shadow-sm">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <File className="h-4 w-4 text-gray-400" />
                                    <span className="font-medium">
                                      {files.find(file => file.id === activeFileId)?.name}
                                    </span>
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {files.find(file => file.id === activeFileId)?.data.length} rows of data
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            <p className="text-gray-600 mb-6">
                              {activeFileId 
                                ? "Click the 'Generate Analysis' button to start the analysis." 
                                : "Select a file from the sidebar to analyze."}
                            </p>
                            
                            {/* Show Generate button in mobile view */}
                            {activeFileId && (
                              <div className="md:hidden mt-4">
                                <Button 
                                  onClick={handleGenerate} 
                                  disabled={isGenerating}
                                  className="w-full"
                                >
                                  {isGenerating ? 'Generating...' : 'Generate Analysis'}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="survey" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
              {activeTab === 'survey' && (
                <div className="mt-4">
                  {!showSurveyConverter ? (
                    <SurveyLandingPage onFileUpload={handleSurveyFileUpload} />
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={handleRemoveSurveyFile}
                          className="text-gray-500 flex items-center"
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Back to Upload
                        </Button>
                      </div>
                      <SurveyConverter initialFile={surveyFile} />
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </main>
  );
}
