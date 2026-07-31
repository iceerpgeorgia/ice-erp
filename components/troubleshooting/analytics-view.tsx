'use client';

import React, { useState } from 'react';
import { Check, X, Calendar, Mail, Eye } from 'lucide-react';
import { format } from 'date-fns';

interface Prompt {
  uuid: string;
  user_email: string;
  created_at: Date;
  page_context: string | null;
  original_description: string;
  generated_prompt: string;
  edited_prompt: string | null;
  confirmed_by_user: boolean;
  is_followed_up: boolean;
  follow_up_notes: string | null;
}

interface AnalyticsViewProps {
  initialPrompts: Prompt[];
}

export function TroubleshootingAnalyticsView({
  initialPrompts,
}: AnalyticsViewProps) {
  const [prompts, setPrompts] = useState<Prompt[]>(initialPrompts);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<'all' | 'unfollowed' | 'confirmed'>('all');
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const filteredPrompts = prompts.filter(p => {
    if (filter === 'unfollowed') return !p.is_followed_up;
    if (filter === 'confirmed') return p.confirmed_by_user;
    return true;
  });

  const handleMarkFollowedUp = async (uuid: string, notes: string) => {
    setLoading(prev => ({ ...prev, [uuid]: true }));

    try {
      const response = await fetch('/api/troubleshooting/mark-followed-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid, notes }),
      });

      if (response.ok) {
        setPrompts(prev =>
          prev.map(p =>
            p.uuid === uuid
              ? {
                  ...p,
                  is_followed_up: true,
                  follow_up_notes: notes,
                }
              : p
          )
        );
        setEditingNotes(prev => {
          const newNotes = { ...prev };
          delete newNotes[uuid];
          return newNotes;
        });
      }
    } catch (error) {
      console.error('Failed to mark as followed up:', error);
    } finally {
      setLoading(prev => ({ ...prev, [uuid]: false }));
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {(['all', 'unfollowed', 'confirmed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {f === 'all'
              ? 'All'
              : f === 'unfollowed'
              ? 'Unfollowed Up'
              : 'Confirmed by Users'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-semibold text-gray-700">
                Date
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">
                User
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">
                Page
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">
                Issue
              </th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">
                Confirmed
              </th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">
                Followed Up
              </th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredPrompts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No prompts found
                </td>
              </tr>
            ) : (
              filteredPrompts.map(prompt => (
                <React.Fragment key={prompt.uuid}>
                  <tr className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-gray-400" />
                        {format(new Date(prompt.created_at), 'MMM d, yyyy')}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Mail size={16} className="text-gray-400" />
                        <span className="text-gray-700">{prompt.user_email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {prompt.page_context || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700 truncate max-w-xs">
                        {prompt.original_description}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {prompt.confirmed_by_user ? (
                        <Check size={18} className="text-green-600 mx-auto" />
                      ) : (
                        <X size={18} className="text-gray-400 mx-auto" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {prompt.is_followed_up ? (
                        <Check size={18} className="text-green-600 mx-auto" />
                      ) : (
                        <X size={18} className="text-red-600 mx-auto" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() =>
                          setExpandedId(
                            expandedId === prompt.uuid ? null : prompt.uuid
                          )
                        }
                        className="flex items-center justify-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                      >
                        <Eye size={16} />
                        View
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Row */}
                  {expandedId === prompt.uuid && (
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <td colSpan={7} className="px-4 py-4">
                        <div className="space-y-4">
                          {/* Original Description */}
                          <div>
                            <h4 className="font-semibold text-gray-800 mb-2">
                              Original Description
                            </h4>
                            <p className="bg-white p-3 rounded border border-gray-200 text-gray-700 whitespace-pre-wrap">
                              {prompt.original_description}
                            </p>
                          </div>

                          {/* Generated Prompt */}
                          <div>
                            <h4 className="font-semibold text-gray-800 mb-2">
                              AI-Generated Prompt
                            </h4>
                            <p className="bg-white p-3 rounded border border-blue-200 text-gray-700 whitespace-pre-wrap">
                              {prompt.generated_prompt}
                            </p>
                          </div>

                          {/* Edited Prompt */}
                          {prompt.edited_prompt && (
                            <div>
                              <h4 className="font-semibold text-gray-800 mb-2">
                                User-Edited Prompt
                              </h4>
                              <p className="bg-white p-3 rounded border border-yellow-200 text-gray-700 whitespace-pre-wrap">
                                {prompt.edited_prompt}
                              </p>
                            </div>
                          )}

                          {/* Follow-up Section */}
                          {!prompt.is_followed_up ? (
                            <div className="bg-white p-4 rounded border border-red-200">
                              <h4 className="font-semibold text-gray-800 mb-3">
                                Mark as Followed Up
                              </h4>
                              <textarea
                                value={editingNotes[prompt.uuid] || ''}
                                onChange={e =>
                                  setEditingNotes(prev => ({
                                    ...prev,
                                    [prompt.uuid]: e.target.value,
                                  }))
                                }
                                placeholder="Enter follow-up notes (actions taken, resolution, etc.)"
                                className="w-full p-2 border border-gray-300 rounded mb-3 resize-none"
                                rows={3}
                              />
                              <button
                                onClick={() =>
                                  handleMarkFollowedUp(
                                    prompt.uuid,
                                    editingNotes[prompt.uuid] || ''
                                  )
                                }
                                disabled={loading[prompt.uuid]}
                                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                              >
                                {loading[prompt.uuid] ? 'Saving...' : 'Mark Complete'}
                              </button>
                            </div>
                          ) : (
                            <div className="bg-green-50 p-4 rounded border border-green-200">
                              <h4 className="font-semibold text-green-800 mb-2">
                                ✓ Followed Up
                              </h4>
                              {prompt.follow_up_notes && (
                                <p className="text-green-700 whitespace-pre-wrap">
                                  {prompt.follow_up_notes}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TroubleshootingAnalyticsView;
