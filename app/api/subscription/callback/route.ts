import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { SUBSCRIPTION_PLANS } from '@/lib/subscription';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { reference, status, metadata } = body;

    // Verify the payment with NotchPay
    const verifyResponse = await fetch(`https://api.notchpay.co/payments/${reference}`, {
      headers: {
        'Authorization': `Bearer ${process.env.NOTCHPAY_SECRET_KEY}`
      }
    });

    const verifyData = await verifyResponse.json();

    if (!verifyResponse.ok || verifyData.transaction?.status !== 'success') {
      throw new Error('Payment verification failed');
    }

    // Get the user ID from metadata
    const userId = metadata?.userId;
    if (!userId) {
      throw new Error('User ID not found in payment metadata');
    }

    // Get the plan from metadata
    const planName = metadata?.plan;
    if (!planName) {
      throw new Error('Plan not found in payment metadata');
    }

    // Update the subscription in the database
    const { error } = await supabase
      .from('subscriptions')
      .update({
        plan_name: planName,
        status: 'active',
        payment_reference: reference,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (error) throw error;

    // Redirect to success page
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/subscription/success`);
  } catch (error) {
    console.error('Subscription callback error:', error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/subscription/error`);
  }
} 