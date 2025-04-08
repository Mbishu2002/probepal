'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase, isSuperUser, getExportsCount } from '@/lib/supabase';
import { SUBSCRIPTION_PLANS, getUserSubscription, getRemainingExports } from '@/lib/subscription';

interface Subscription {
  id: string;
  plan_name: string;
  status: 'active' | 'inactive';
  payment_reference: string | null;
  documentsRemaining: number;
}

interface SubscriptionContextType {
  subscription: Subscription | null;
  isLoading: boolean;
  initializePayment: (plan: string) => Promise<string>;
  checkSubscription: () => Promise<void>;
  trackDocumentExport: (documentId: string) => Promise<boolean>;
  remainingExports: number;
  isUnlimited: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [remainingExports, setRemainingExports] = useState<number>(0);
  const [isUnlimited, setIsUnlimited] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSubscription() {
      if (!user) {
        setSubscription(null);
        setRemainingExports(0);
        setLoading(false);
        return;
      }

      try {
        // First check if user is a super user
        const unlimited = await isSuperUser(user.id);
        setIsUnlimited(unlimited);

        if (unlimited) {
          setRemainingExports(Infinity);
          setLoading(false);
          return;
        }

        const { data: subscriptionData, error: subscriptionError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (subscriptionError) throw subscriptionError;

        if (subscriptionData) {
          setSubscription(subscriptionData);

          // Get the number of documents exported this month
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);

          const { data: exportsData, error: exportsError } = await supabase
            .from('document_exports')
            .select('id')
            .eq('user_id', user.id)
            .gte('created_at', startOfMonth.toISOString());

          if (exportsError) throw exportsError;

          const exportsCount = exportsData?.length || 0;
          const planLimit = subscriptionData.plan_name === 'Free' ? 0 :
                           subscriptionData.plan_name === 'Basic' ? 5 : 20;
          const remaining = Math.max(0, planLimit - exportsCount);
          setRemainingExports(remaining);
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSubscription();
  }, [user]);

  const trackDocumentExport = async (documentId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      // Check if user is a super user
      const unlimited = await isSuperUser(user.id);
      if (unlimited) return true;

      // For regular users, check subscription limits
      if (!subscription) return false;

      const exportsCount = await getExportsCount(user.id);
      const planLimit = subscription.plan_name === 'Free' ? 0 :
                       subscription.plan_name === 'Basic' ? 5 : 20;

      if (exportsCount >= planLimit) return false;

      // Create export record
      const { error } = await supabase
        .from('document_exports')
        .insert({
          user_id: user.id,
          document_id: documentId,
          created_at: new Date().toISOString()
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error tracking document export:', error);
      return false;
    }
  };

  const initializePayment = async (plan: string): Promise<string> => {
    try {
      // Map plan names to their corresponding keys
      const planMap: Record<string, string> = {
        'Free': 'free',
        'Basic': 'basic',
        'Pro': 'pro'
      };

      const planKey = planMap[plan];
      if (!planKey) {
        throw new Error('Invalid plan selected');
      }

      const selectedPlan = SUBSCRIPTION_PLANS[planKey];
      if (!selectedPlan) {
        throw new Error('Invalid plan selected');
      }

      const response = await fetch('https://api.notchpay.co/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_NOTCHPAY_PUBLIC_KEY}`
        },
        body: JSON.stringify({
          amount: selectedPlan.price,
          currency: 'XAF',
          customer: {
            email: user?.email,
            name: user?.user_metadata?.full_name || user?.email?.split('@')[0]
          },
          description: `${selectedPlan.name} Plan Subscription`,
          reference: `sub_${user?.id}_${Date.now()}`,
          callback: `${window.location.origin}/api/subscription/callback`,
          metadata: {
            plan: selectedPlan.name,
            userId: user?.id
          }
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to initialize payment');
      }

      if (data.status !== 'Accepted') {
        throw new Error(data.message || 'Payment initialization failed');
      }

      return data.authorization_url;
    } catch (error) {
      console.error('Error initializing payment:', error);
      throw error;
    }
  };

  return (
    <SubscriptionContext.Provider value={{ 
      subscription, 
      isLoading: loading, 
      initializePayment, 
      checkSubscription: () => Promise.resolve(),
      trackDocumentExport,
      remainingExports,
      isUnlimited
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
} 