import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { updateSubscriptionStatus } from '@/lib/subscription';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const CAMPAY_API_KEY = process.env.CAMPAY_API_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(request: Request) {
  try {
    const callbackData = await request.json();

    // Verify the payment status
    const response = await fetch(`https://api.campay.net/api/transaction/${callbackData.reference}`, {
      headers: {
        'Authorization': `Bearer ${CAMPAY_API_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to verify payment');
    }

    const paymentData = await response.json();

    // Update subscription status based on payment status
    if (paymentData.status === 'SUCCESSFUL') {
      await updateSubscriptionStatus(callbackData.external_reference, 'active');
    } else if (paymentData.status === 'FAILED') {
      await updateSubscriptionStatus(callbackData.external_reference, 'failed');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing payment callback:', error);
    return NextResponse.json(
      { error: 'Failed to process payment callback' },
      { status: 500 }
    );
  }
} 