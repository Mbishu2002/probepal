'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Check, ChevronLeft } from 'lucide-react';
import { initiateSubscription } from '@/lib/subscription';

const SUBSCRIPTION_PLANS = [
  {
    name: 'Free',
    price: 0,
    documents: 0,
    features: [
      'Basic data analysis',
      'Limited exports',
      'Standard support'
    ]
  },
  {
    name: 'Basic',
    price: 5000, // 5000 FCFA
    documents: 5, // 5 exports per month
    features: [
      'Advanced data analysis',
      '5 exports per month',
      'Priority support',
      'Data visualization',
      'Export to multiple formats'
    ]
  },
  {
    name: 'Pro',
    price: 15000, // 15000 FCFA
    documents: 15, // 15 exports per month
    features: [
      'Everything in Basic',
      '15 exports per month',
      '24/7 support',
      'Advanced analytics',
      'Custom reports',
      'API access'
    ]
  }
];

export default function PricingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleSubscribe = async (plan: typeof SUBSCRIPTION_PLANS[0]) => {
    if (!user) {
      router.push('/auth');
      return;
    }

    setIsLoading(plan.name);

    try {
      if (plan.name === 'Free') {
        // Handle free plan subscription
        await initiateSubscription(user.id, plan.name);
        router.push('/');
        return;
      }

      // Handle paid plan subscription
      const response = await initiateSubscription(user.id, plan.name);
      
      if (response.success) {
        // Redirect to payment page or handle payment flow
        window.location.href = response.paymentUrl;
      } else {
        alert('Failed to initiate subscription. Please try again.');
      }
    } catch (error) {
      console.error('Subscription error:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/')}
            className="text-gray-500 flex items-center"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Home
          </Button>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600">
            Select the perfect plan for your research needs
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <div
              key={plan.name}
              className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow"
            >
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {plan.name}
                </h2>
                <div className="text-4xl font-bold text-gray-900 mb-2">
                  {plan.price === 0 ? (
                    'Free'
                  ) : (
                    <>
                      {plan.price.toLocaleString()} <span className="text-lg text-gray-500">FCFA/month</span>
                    </>
                  )}
                </div>
                {plan.documents > 0 && (
                  <p className="text-gray-600">
                    {plan.documents} exports per month
                  </p>
                )}
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center text-gray-600">
                    <Check className="h-5 w-5 text-green-500 mr-2" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleSubscribe(plan)}
                disabled={isLoading === plan.name}
                className={`w-full ${
                  plan.name === 'Pro'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : plan.name === 'Basic'
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : 'bg-gray-600 hover:bg-gray-700'
                } text-white`}
              >
                {isLoading === plan.name ? 'Processing...' : 'Subscribe Now'}
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Need a custom plan?
          </h2>
          <p className="text-gray-600 mb-6">
            Contact us for enterprise solutions and custom requirements
          </p>
          <Button
            variant="outline"
            onClick={() => router.push('/contact')}
            className="text-gray-600 hover:text-blue-600"
          >
            Contact Sales
          </Button>
        </div>
      </div>
    </div>
  );
} 