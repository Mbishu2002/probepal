'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useSubscription } from '@/contexts/SubscriptionContext';

interface AuthFormProps {
  mode: 'signin' | 'signup' | 'forgot';
  onSuccess?: () => void;
}

export default function AuthForm({ mode, onSuccess }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const router = useRouter();
  const [currentMode, setCurrentMode] = useState<'signin' | 'signup' | 'forgot'>(mode);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setCurrentMode(mode);
    setEmail('');
    setPassword('');
    setError(null);
    setMessage(null);
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail) {
      setError('Please enter your email address');
      setLoading(false);
      return;
    }

    if (currentMode !== 'forgot' && !trimmedPassword) {
      setError('Please enter your password');
      setLoading(false);
      return;
    }

    try {
      if (currentMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password: trimmedPassword
        });
        if (error) throw error;
        
        // Create free subscription in Supabase
        if (data.user) {
          const { error: subscriptionError } = await supabase
            .from('subscriptions')
            .insert([
              {
                user_id: data.user.id,
                plan_name: 'Free',
                status: 'active',
                payment_reference: null
              }
            ]);
          
          if (subscriptionError) throw subscriptionError;
        }
        
        setMessage('Sign up successful! Please check your email to verify your account.');
        setCurrentMode('signin');
      } else if (currentMode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password: trimmedPassword
        });
        if (error) throw error;
        setMessage('Successfully logged in!');
        if (onSuccess) onSuccess();
        router.push('/');
      } else if (currentMode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail);
        if (error) throw error;
        setMessage('Password reset link has been sent to your email!');
        setCurrentMode('signin');
      }
    } catch (error: any) {
      setError(error.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">
          {currentMode === 'signin'
            ? 'Sign In'
            : currentMode === 'signup'
            ? 'Create Account'
            : 'Reset Password'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1"
            placeholder="Enter your email"
          />
        </div>

        {currentMode !== 'forgot' && (
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1"
              placeholder="Enter your password"
            />
          </div>
        )}

        {error && (
          <div className="text-red-600 text-sm">
            {error}
          </div>
        )}

        {message && (
          <div className="text-green-600 text-sm">
            {message}
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={loading}
        >
          {loading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            </div>
          ) : currentMode === 'signin' ? (
            'Sign In'
          ) : currentMode === 'signup' ? (
            'Sign Up'
          ) : (
            'Send Reset Link'
          )}
        </Button>

        <div className="text-center space-y-2">
          {currentMode === 'signin' ? (
            <>
              <button
                type="button"
                onClick={() => setCurrentMode('signup')}
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                Need an account? Sign up
              </button>
              <button
                type="button"
                onClick={() => setCurrentMode('forgot')}
                className="block w-full text-sm text-blue-600 hover:text-blue-500"
              >
                Forgot password?
              </button>
            </>
          ) : currentMode === 'signup' ? (
            <button
              type="button"
              onClick={() => setCurrentMode('signin')}
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              Already have an account? Sign in
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCurrentMode('signin')}
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              Back to Sign In
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
