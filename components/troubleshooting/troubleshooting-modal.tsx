'use client';

import React, { useState } from 'react';
import { X, Loader, CheckCircle, ArrowLeft } from 'lucide-react';

interface TroubleshootingModalProps {
  isOpen: boolean;
  onClose: () => void;
  pageContext?: string;
  userEmail: string;
}

type Step = 'input' | 'generating' | 'confirm' | 'success';

export function TroubleshootingModal({
  isOpen,
  onClose,
  pageContext,
  userEmail,
}: TroubleshootingModalProps) {
  const [step, setStep] = useState<Step>('input');
  const [description, setDescription] = useState('');
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [editedPrompt, setEditedPrompt] = useState('');
  const [recordUuid, setRecordUuid] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleGeneratePrompt = async () => {
    if (!description.trim()) {
      setError('Please describe your issue');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/troubleshooting/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userDescription: description,
          pageContext: pageContext || 'General',
          userEmail,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate prompt');
      }

      setRecordUuid(data.uuid);
      setGeneratedPrompt(data.generatedPrompt);
      setEditedPrompt(data.generatedPrompt);
      setStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPrompt = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/troubleshooting/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uuid: recordUuid,
          editedPrompt: editedPrompt !== generatedPrompt ? editedPrompt : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to confirm prompt');
      }

      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setStep('input');
    setDescription('');
    setGeneratedPrompt('');
    setEditedPrompt('');
    setRecordUuid('');
    setError('');
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
          {step === 'confirm' && step !== 'success' && (
            <button
              onClick={() => setStep('input')}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft size={18} />
              <span>Back</span>
            </button>
          )}
          {step !== 'confirm' && <div />}
          <h2 className="text-xl font-semibold text-gray-800">
            {step === 'input' && 'Describe Your Issue'}
            {step === 'generating' && 'Analyzing...'}
            {step === 'confirm' && 'Review Generated Prompt'}
            {step === 'success' && 'Troubleshooting Recorded'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Input */}
          {step === 'input' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What's your issue or pain point?
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what you're experiencing..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={5}
                />
              </div>

              {pageContext && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <strong>Page:</strong> {pageContext}
                  </p>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button
                onClick={handleGeneratePrompt}
                disabled={loading || !description.trim()}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors font-medium flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader size={18} className="animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  'Generate Troubleshooting Prompt'
                )}
              </button>
            </div>
          )}

          {/* Step 2: Generating */}
          {step === 'generating' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader size={40} className="animate-spin text-blue-600 mb-4" />
              <p className="text-gray-600">Analyzing your issue with AI...</p>
            </div>
          )}

          {/* Step 3: Confirm/Edit */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  AI-Generated Troubleshooting Prompt
                </label>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4 max-h-48 overflow-y-auto">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">
                    {generatedPrompt}
                  </p>
                </div>

                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Edit if needed (optional)
                </label>
                <textarea
                  value={editedPrompt}
                  onChange={(e) => setEditedPrompt(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={6}
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('input')}
                  disabled={loading}
                  className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 transition-colors font-medium"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirmPrompt}
                  disabled={loading}
                  className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader size={18} className="animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    'Confirm & Save'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Success */}
          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle size={48} className="text-green-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Troubleshooting Recorded!
              </h3>
              <p className="text-gray-600 text-center mb-6">
                Your issue has been recorded and our support team will review it to improve the app.
              </p>
              <button
                onClick={handleClose}
                className="py-2 px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TroubleshootingModal;
