'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';

type Step = 'gate' | 'countdown' | 'checkpoint';

export default function GatewayPage() {
  const { token } = useParams<{ token: string }>();

  const [step, setStep] = useState<Step>('gate');
  const [countdown, setCountdown] = useState(5);
  const [adUrl, setAdUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/gateway-token/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return setError(data.error);
        if (data.status === 'completed') return setError('This link has already been used');
        setAdUrl(data.adUrl);
      })
      .catch(() => setError('Failed to load gateway'));
  }, [token]);

  const handleContinue = useCallback(() => {
    setStep('countdown');
  }, []);

  useEffect(() => {
    if (step !== 'countdown') return;
    if (countdown <= 0) {
      setStep('checkpoint');
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, countdown]);

  if (error) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-red-500/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Gateway Error</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full text-center space-y-8">
        {step === 'gate' && (
          <>
            <div className="space-y-4">
              <h1 className="text-3xl font-bold text-white">Extoboost Key Gateway Verification</h1>
              <p className="text-gray-400">
                Click below to begin the verification process and unlock your key.
              </p>
            </div>
            <button
              onClick={handleContinue}
              className="w-full px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold text-lg rounded-xl transition-colors"
            >
              Continue to Checkpoint
            </button>
          </>
        )}

        {step === 'countdown' && (
          <div className="space-y-6 py-12">
            <div className="w-16 h-16 mx-auto border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-white">Verifying secure connection parameters...</h2>
              <p className="text-5xl font-bold text-primary-400 tabular-nums">{countdown}s</p>
              <p className="text-gray-500 text-sm">Please wait while we prepare your route</p>
            </div>
          </div>
        )}

        {step === 'checkpoint' && (
          <div className="space-y-6 py-12">
            <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-white">Connection Verified</h2>
              <p className="text-gray-400">Your route is ready. Proceed to unlock your key.</p>
            </div>
            <a
              href={adUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block w-full px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold text-lg rounded-xl transition-colors"
            >
              Proceed to Unlock Key
            </a>
            <p className="text-xs text-gray-600">
              Complete the ad to receive your verification key
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
