'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      if (currentMode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Sign up successful! Please check your email to verify your account.');
        setCurrentMode('signin');
      } else if (currentMode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        alert('Successfully logged in!');
        router.push('/');
      } else if (currentMode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        alert('Password reset link has been sent to your email!');
        setCurrentMode('signin');
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">
          {currentMode === 'signin' ? 'Sign In' : currentMode === 'signup' ? 'Create Account' : 'Reset Password'}
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          {currentMode === 'signin' 
            ? "Don't have an account? Sign up" 
            : currentMode === 'signup' ? "Already have an account? Sign in" : "Already have an account? Sign in"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1"
          />
        </div>

        {currentMode !== 'forgot' && (
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1"
            />
          </div>
        )}

        {error && (
          <div className="text-red-600 text-sm">
            {error}
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
          ) : (
            <button
              type="button"
              onClick={() => setCurrentMode('signin')}
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              Already have an account? Sign in
            </button>
          )}
        </div>
      </form>
    </div>
  );
}