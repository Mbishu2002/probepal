'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import EditableMarkdown from '@/components/EditableMarkdown';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Menu } from 'lucide-react';
import { getRemainingExports } from '@/lib/subscription';
import { supabase } from '@/lib/supabase';
import UserDropdown from '@/components/ui/UserDropdown';

interface FileItem {
  id: string;
  name: string;
  data: any[];
}

export default function AnalysisPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>('Google Gemini 2.0 Flash');
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [showSidebar, setShowSidebar] = useState<boolean>(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [remainingExports, setRemainingExports] = useState<{ remaining: number; plan: string } | null>(null);
  const [isSuperUser, setIsSuperUser] = useState<boolean>(false);

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
          setRemainingExports(exports);
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

  const handleFileSelect = (fileId: string) => {
    setActiveFileId(fileId);
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
      const jsonData = activeFile.data.slice(0, 100);
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: jsonData,
          model: selectedModel,
          systemPrompt
        }),
      });
      
      const data = await response.json();
      setGeneratedContent(data.content);
      
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
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/')}
            className="text-gray-500 flex items-center"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Home
          </Button>
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

        <div className="relative flex flex-col md:flex-row h-screen overflow-hidden">
          <div className={`
            fixed inset-y-0 left-0 z-10 w-64 transition-all duration-300
            ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}>
            <div className="h-full">
              <Sidebar 
                files={files}
                activeFileId={activeFileId}
                onFileSelect={handleFileSelect}
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
            <div className="p-4 md:p-6">
              {generatedContent ? (
                <div>
                  <EditableMarkdown 
                    content={generatedContent} 
                    isLoading={isGenerating}
                    documentId={activeFileId || undefined}
                    isSuperUser={isSuperUser}
                  />
                  {!isSuperUser && (
                    <div className="mt-4 flex justify-between items-center">
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800">
                          {remainingExports?.remaining || 0} exports remaining
                        </p>
                      </div>
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
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="text-center max-w-md">
                    <h2 className="text-xl md:text-2xl font-bold mb-4">Ready to Analyze</h2>
                    <p className="text-gray-600">
                      Select a file from the sidebar to analyze.
                    </p>
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