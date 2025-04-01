import React from 'react';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

interface PricingPlan {
  name: string;
  price: number;
  documents: number;
  features: string[];
  popular?: boolean;
}

const plans: PricingPlan[] = [
  {
    name: "Free",
    price: 0,
    documents: 0,
    features: [
      "View document analysis",
      "Basic analysis features",
      "Excel file support",
      "No exports",
      "No time limit"
    ]
  },
  {
    name: "Basic",
    price: 5000,
    documents: 3,
    features: [
      "3 document exports",
      "Basic analysis features",
      "Excel file support",
      "Email support",
      "Valid for 30 days"
    ],
    popular: true
  },
  {
    name: "Pro",
    price: 15000,
    documents: 10,
    features: [
      "10 document exports",
      "Advanced analysis features",
      "Priority support",
      "All file formats",
      "Valid for 30 days"
    ]
  }
];

interface PricingPlansProps {
  onSelectPlan: (plan: PricingPlan) => void;
}

const PricingPlans: React.FC<PricingPlansProps> = ({ onSelectPlan }) => {
  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="text-center">
        <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
          Choose Your Plan
        </h2>
        <p className="mt-4 text-lg text-gray-600">
          Select a plan that best fits your needs. All plans include our core analysis features.
        </p>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`relative rounded-2xl border ${
              plan.popular
                ? 'border-blue-600 shadow-lg'
                : 'border-gray-200'
            } p-8`}
          >
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="inline-flex items-center px-4 py-1 rounded-full text-sm font-semibold bg-blue-600 text-white">
                  Most Popular
                </span>
              </div>
            )}
            
            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
              <div className="mt-4 flex items-baseline justify-center">
                <span className="text-4xl font-extrabold text-gray-900">{plan.price.toLocaleString()} FCFA</span>
                <span className="ml-1 text-xl font-semibold text-gray-500">/month</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                {plan.documents} document exports
              </p>
            </div>

            <ul className="mt-8 space-y-4">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center">
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="ml-3 text-sm text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>

            <Button
              onClick={() => onSelectPlan(plan)}
              className={`mt-8 w-full ${
                plan.popular
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Select {plan.name}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PricingPlans; 