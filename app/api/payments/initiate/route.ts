import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const CAMPAY_API_KEY = process.env.CAMPAY_API_KEY!;
const CAMPAY_API_URL = 'https://api.campay.net/api';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(request: Request) {
  try {
    const { amount, currency, subscriptionId, userId } = await request.json();

    // Get user details from Supabase
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('email, phone')
      .eq('id', userId)
      .single();

    if (userError) {
      throw userError;
    }

    // Initialize Campay payment
    const response = await fetch(`${CAMPAY_API_URL}/collect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CAMPAY_API_KEY}`
      },
      body: JSON.stringify({
        amount,
        currency,
        external_reference: subscriptionId,
        description: 'ProbePal Subscription Payment',
        customer: {
          email: user.email,
          phone_number: user.phone
        },
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/callback`
      })
    });

    if (!response.ok) {
      throw new Error('Failed to initiate Campay payment');
    }

    const paymentData = await response.json();

    // Update subscription with payment reference
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        payment_reference: paymentData.reference,
        payment_status: 'pending'
      })
      .eq('id', subscriptionId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json(paymentData);
  } catch (error) {
    console.error('Error initiating payment:', error);
    return NextResponse.json(
      { error: 'Failed to initiate payment' },
      { status: 500 }
    );
  }
} 