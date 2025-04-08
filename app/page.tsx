'use client';

import React, { useState, useEffect } from 'react';
import LandingPage from '@/components/LandingPage';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';



export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

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
    return <LandingPage />;
  }

  return <LandingPage />;
}
