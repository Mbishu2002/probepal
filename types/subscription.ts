export interface Subscription {
  id: string;
  user_id: string;
  plan_name: 'Free' | 'Basic' | 'Pro';
  status: 'active' | 'inactive' | 'cancelled';
  payment_reference: string | null;
  documents_allowed: number;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionContextType {
  subscription: Subscription | null;
  isLoading: boolean;
  initializePayment: (plan: string) => Promise<string>;
  checkSubscription: () => Promise<void>;
  trackDocumentExport: (documentId: string) => Promise<boolean>;
  remainingExports: number;
  isUnlimited: boolean;
} 