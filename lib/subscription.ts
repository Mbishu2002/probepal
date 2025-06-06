import { supabase } from './supabase';

interface SubscriptionPlan {
  name: string;
  price: number;
  documents: number;
  features: string[];
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  free: {
    name: 'Free',
    price: 0,
    documents: 0,
    features: [
      'Basic document viewing',
      'Limited export capabilities',
      'Community support'
    ]
  },
  basic: {
    name: 'Basic',
    price: 5000,
    documents: 5,
    features: [
      '5 document exports per month',
      'Advanced analysis features',
      'Email support'
    ]
  },
  pro: {
    name: 'Pro',
    price: 15000,
    documents: 20,
    features: [
      '20 document exports per month',
      'Priority support',
      'Advanced analytics',
      'API access'
    ]
  }
};

// Super user email
const SUPER_USER_EMAIL = 'fmbishu@gmail.com';

export async function initiateSubscription(userId: string, plan: string) {
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

    // Get the selected plan
    const selectedPlan = SUBSCRIPTION_PLANS[planKey];
    if (!selectedPlan) {
      throw new Error('Invalid plan selected');
    }

    // Create a subscription record in Supabase
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .insert([
        {
          user_id: userId,
          plan_name: selectedPlan.name,
          status: 'active',
          payment_reference: null
        }
      ])
      .select()
      .single();

    if (subscriptionError) {
      throw subscriptionError;
    }

    return { success: true, subscription };
  } catch (error) {
    console.error('Error initiating subscription:', error);
    throw error;
  }
}

export async function updateSubscriptionStatus(subscriptionId: string, status: string) {
  try {
    const { error } = await supabase
      .from('subscriptions')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', subscriptionId);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error updating subscription status:', error);
    throw error;
  }
}

export async function getUserSubscription(userId: string) {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error getting user subscription:', error);
    throw error;
  }
}

export async function trackDocumentExport(userId: string, documentId: string) {
  try {
    // Get user's email to check if they're the super user
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    if (userError) {
      throw userError;
    }

    // If user is super user, allow unlimited exports
    if (userData.email === SUPER_USER_EMAIL) {
      return true;
    }

    // Get user's active subscription
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (subscriptionError) {
      throw subscriptionError;
    }

    // If no active subscription or free plan, don't track
    if (!subscription || subscription.plan === 'Free') {
      return true;
    }

    // Check if user has exports remaining
    if (subscription.documents_remaining <= 0) {
      throw new Error('No exports remaining in your subscription');
    }

    // Create export record
    const { error: exportError } = await supabase
      .from('document_exports')
      .insert([
        {
          user_id: userId,
          subscription_id: subscription.id,
          document_id: documentId,
          created_at: new Date().toISOString()
        }
      ]);

    if (exportError) {
      throw exportError;
    }

    // Decrement remaining exports
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        documents_remaining: subscription.documents_remaining - 1
      })
      .eq('id', subscription.id);

    if (updateError) {
      throw updateError;
    }

    return true;
  } catch (error) {
    console.error('Error tracking document export:', error);
    throw error;
  }
}

export async function getRemainingExports(userId: string) {
  try {
    // Get user's email to check if they're the super user
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    if (userError) {
      throw userError;
    }

    // If user is super user, return unlimited exports
    if (userData.email === SUPER_USER_EMAIL) {
      return {
        remaining: 999999, // Effectively unlimited
        plan: 'Super User'
      };
    }

    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('documents_remaining, plan')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error) {
      throw error;
    }

    return {
      remaining: subscription?.documents_remaining || 0,
      plan: subscription?.plan || 'Free'
    };
  } catch (error) {
    console.error('Error getting remaining exports:', error);
    throw error;
  }
}

export async function getExportHistory(userId: string) {
  try {
    const { data, error } = await supabase
      .from('document_exports')
      .select(`
        *,
        documents (
          name,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error getting export history:', error);
    throw error;
  }
} 