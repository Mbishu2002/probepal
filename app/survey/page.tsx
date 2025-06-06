'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import SurveyConverter from '@/components/SurveyConverter';
import UserDropdown from '@/components/ui/UserDropdown';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export default function SurveyPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth');
    }
  }, [loading, user, router]);

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

          {/* Only show UserDropdown if user is logged in */}
          {user && <UserDropdown />}
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-bold mb-6">Survey Data Processing</h1>
          <SurveyConverter />
        </div>
      </div>
    </div>
  );
} 