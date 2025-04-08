'use client';

import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, ClipboardList, ArrowRight, FileText, FileSpreadsheet as ExcelIcon, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SurveyConverter from './SurveyConverter';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { SUBSCRIPTION_PLANS } from '@/lib/subscription';
import UserDropdown from '@/components/ui/UserDropdown';

export default function LandingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { subscription, initializePayment } = useSubscription();
  const excelFileInputRef = useRef<HTMLInputElement>(null);
  const surveyFileInputRef = useRef<HTMLInputElement>(null);
  const [surveyFile, setSurveyFile] = useState<File | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleUpgrade = async (plan: string) => {
    try {
      setIsProcessingPayment(true);
      const paymentUrl = await initializePayment(plan);
      window.location.href = paymentUrl;
    } catch (error) {
      console.error('Error initializing payment:', error);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleExcelUploadClick = () => {
    if (!user) {
      router.push('/auth');
      return;
    }
    excelFileInputRef.current?.click();
  };

  const handleSurveyUploadClick = () => {
    surveyFileInputRef.current?.click();
  };

  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Create a URL for the file
      const fileUrl = URL.createObjectURL(file);
      // Navigate to analysis page with the file data
      router.push(`/analysis?file=${encodeURIComponent(fileUrl)}`);
    }
  };

  const handleSurveyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      router.push('/survey');
    }
  };

  const handleRemoveSurveyFile = () => {
    setSurveyFile(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">ProbePal</h1>
            </div>

            {/* Mobile menu button */}
            <div className="flex md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              >
                <span className="sr-only">Open main menu</span>
                {mobileMenuOpen ? (
                  <X className="block h-6 w-6" />
                ) : (
                  <Menu className="block h-6 w-6" />
                )}
              </button>
            </div>

            {/* Desktop menu */}
            <div className="hidden md:flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => router.push('/pricing')}
                className="text-gray-600 hover:text-blue-600"
              >
                Pricing
              </Button>
              {user && (!subscription || subscription?.plan_name === 'Free') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/pricing')}
                  className="text-gray-600 hover:text-blue-600"
                >
                  Upgrade
                </Button>
              )}
              {user ? (
                <UserDropdown />
              ) : (
                <Button
                  onClick={() => router.push('/auth')}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Sign Up
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <div className={`md:hidden ${mobileMenuOpen ? 'block' : 'hidden'}`}>
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <Button
              variant="ghost"
              onClick={() => {
                router.push('/pricing');
                setMobileMenuOpen(false);
              }}
              className="w-full text-left text-gray-600 hover:text-blue-600"
            >
              Pricing
            </Button>
            {user && (!subscription || subscription?.plan_name === 'Free') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  router.push('/pricing');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left text-gray-600 hover:text-blue-600"
              >
                Upgrade
              </Button>
            )}
            {user ? (
              <div className="px-2">
                <UserDropdown />
              </div>
            ) : (
              <Button
                onClick={() => {
                  router.push('/auth');
                  setMobileMenuOpen(false);
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                Sign Up
              </Button>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to ProbePal
          </h1>
          <p className="text-xl text-gray-600 mb-12">
            Your AI-powered research assistant for data analysis and survey processing
          </p>
        </div>

        {surveyFile ? (
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center mb-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleRemoveSurveyFile}
                className="text-gray-500"
              >
                ← Back to Upload
              </Button>
            </div>
            <SurveyConverter initialFile={surveyFile} />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Excel Analysis Card */}
            <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
              <div className="flex items-center mb-4">
                <ExcelIcon className="h-8 w-8 text-blue-600 mr-3" />
                <h2 className="text-2xl font-semibold text-gray-900">Excel Analysis</h2>
              </div>
              <p className="text-gray-600 mb-6">
                Upload your Excel files for advanced data analysis, visualization, and insights generation.
              </p>
              <div className="space-y-4">
                <div className="flex items-center text-sm text-gray-500">
                  <ArrowRight className="h-4 w-4 mr-2 text-blue-600" />
                  <span>Data visualization and charts</span>
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <ArrowRight className="h-4 w-4 mr-2 text-blue-600" />
                  <span>Statistical analysis</span>
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <ArrowRight className="h-4 w-4 mr-2 text-blue-600" />
                  <span>AI-powered insights</span>
                </div>
              </div>
              <div className="mt-6 space-y-4">
                <Button
                  onClick={handleExcelUploadClick}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Excel File
                </Button>
                <p className="text-sm text-gray-500 text-center">
                  Supported formats: .xlsx, .xls
                </p>
              </div>
              <input
                ref={excelFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelFileChange}
                className="hidden"
              />
            </div>

            {/* Survey Data Card */}
            <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
              <div className="flex items-center mb-4">
                <FileText className="h-8 w-8 text-purple-600 mr-3" />
                <h2 className="text-2xl font-semibold text-gray-900">Survey Data</h2>
              </div>
              <p className="text-gray-600 mb-6">
                Process and analyze survey data with our specialized survey data processing tools.
              </p>
              <div className="space-y-4">
                <div className="flex items-center text-sm text-gray-500">
                  <ArrowRight className="h-4 w-4 mr-2 text-purple-600" />
                  <span>Survey data processing</span>
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <ArrowRight className="h-4 w-4 mr-2 text-purple-600" />
                  <span>Response analysis</span>
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <ArrowRight className="h-4 w-4 mr-2 text-purple-600" />
                  <span>Survey insights</span>
                </div>
              </div>
              <div className="mt-6 space-y-4">
                <Button
                  onClick={handleSurveyUploadClick}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Survey File
                </Button>
                <p className="text-sm text-gray-500 text-center">
                  Supported format: .docx
                </p>
              </div>
              <input
                ref={surveyFileInputRef}
                type="file"
                accept=".docx"
                onChange={handleSurveyFileChange}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* Features Section */}
        <div className="mt-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Why Choose ProbePal?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Lightning Fast</h3>
              <p className="text-gray-600">Process your data in seconds with our optimized algorithms</p>
            </div>
            <div className="text-center">
              <div className="bg-purple-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Secure & Private</h3>
              <p className="text-gray-600">Your data is encrypted and never shared with third parties</p>
            </div>
            <div className="text-center">
              <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Accurate Results</h3>
              <p className="text-gray-600">Get precise insights powered by advanced AI models</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
