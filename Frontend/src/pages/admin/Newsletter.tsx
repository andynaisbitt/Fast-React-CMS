// src/pages/admin/Newsletter.tsx
/**
 * Newsletter Subscribers Management Page
 * View, manage, and send newsletters to subscribers
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface Subscriber {
  id: number;
  email: string;
  is_active: boolean;
  subscribed_at: string;
}

export const Newsletter: React.FC = () => {
  const navigate = useNavigate();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedSubscribers, setSelectedSubscribers] = useState<number[]>([]);
  const [showSendModal, setShowSendModal] = useState(false);
  const [newsletter, setNewsletter] = useState({ subject: '', body: '' });
  const [sending, setSending] = useState(false);

  // Fetch subscribers on mount
  useEffect(() => {
    fetchSubscribers();
  }, []);

  const fetchSubscribers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/v1/admin/newsletter/subscribers', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch subscribers');
      }

      const data = await response.json();
      console.log('Subscribers API response:', data);

      // Ensure data is an array
      if (Array.isArray(data)) {
        setSubscribers(data);
      } else if (data && Array.isArray(data.subscribers)) {
        setSubscribers(data.subscribers);
      } else {
        console.error('Unexpected data format:', data);
        setSubscribers([]);
      }
    } catch (err) {
      console.error('Error fetching subscribers:', err);
      setError('Failed to load subscribers. Please try again.');
      setSubscribers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, email: string) => {
    if (!confirm(`Are you sure you want to remove ${email} from the newsletter?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/admin/newsletter/subscribers/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to remove subscriber');
      }

      setSubscribers(subscribers.filter(s => s.id !== id));
      setSuccess(`${email} has been removed from the newsletter.`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error removing subscriber:', err);
      setError('Failed to remove subscriber. Please try again.');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleSendNewsletter = async () => {
    if (!newsletter.subject.trim() || !newsletter.body.trim()) {
      setError('Please fill in both subject and body');
      return;
    }

    try {
      setSending(true);
      setError(null);

      const response = await fetch('/api/v1/admin/newsletter/send-to-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          subject: newsletter.subject,
          body: newsletter.body
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to send newsletter');
      }

      setSuccess(`Newsletter sent to ${data.sent} subscribers! ${data.failed} failed.`);
      setShowSendModal(false);
      setNewsletter({ subject: '', body: '' });
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      console.error('Error sending newsletter:', err);
      setError(err.message || 'Failed to send newsletter. Please check SMTP settings.');
    } finally {
      setSending(false);
    }
  };

  const activeSubscribers = Array.isArray(subscribers) ? subscribers.filter(s => s.is_active) : [];

  if (loading && subscribers.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading subscribers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Newsletter Subscribers
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your newsletter subscribers and send updates
          </p>
        </div>

        {/* Error/Success Banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
            >
              <p className="text-red-800 dark:text-red-300 font-medium">
                ⚠️ {error}
              </p>
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4"
            >
              <p className="text-green-800 dark:text-green-300 font-medium">
                ✓ {success}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Cards - Compact for Mobile */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md border border-gray-200 dark:border-slate-700 p-4 mb-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">{subscribers.length}</p>
              <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1">Total</p>
            </div>
            <div className="text-center border-l border-r border-gray-200 dark:border-slate-700">
              <p className="text-2xl md:text-3xl font-bold text-green-600 dark:text-green-400">{activeSubscribers.length}</p>
              <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1">Active</p>
            </div>
            <div className="text-center">
              <p className="text-2xl md:text-3xl font-bold text-gray-600 dark:text-gray-400">
                {subscribers.length - activeSubscribers.length}
              </p>
              <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1">Inactive</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setShowSendModal(true)}
            disabled={activeSubscribers.length === 0}
            className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            📧 Send
          </button>
          <button
            onClick={fetchSubscribers}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition text-sm"
          >
            🔄
          </button>
          <button
            onClick={() => navigate('/admin/settings')}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition text-sm"
          >
            ⚙️
          </button>
        </div>

        {/* Subscribers List - Mobile Friendly Cards */}
        <div className="space-y-3">
          {subscribers.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md border border-gray-200 dark:border-slate-700 p-12 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                No subscribers yet. The newsletter form will appear in the footer when enabled.
              </p>
            </div>
          ) : (
            subscribers.map((subscriber) => (
              <div
                key={subscriber.id}
                className="bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700 p-4 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {subscriber.email}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          subscriber.is_active
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'
                        }`}
                      >
                        {subscriber.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(subscriber.subscribed_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(subscriber.id, subscriber.email)}
                    className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Back Button */}
        <div className="mt-6">
          <button
            onClick={() => navigate('/admin')}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>

      {/* Send Newsletter Modal */}
      <AnimatePresence>
        {showSendModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 max-w-2xl w-full p-6"
            >
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                Send Newsletter
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                This will send an email to all {activeSubscribers.length} active subscribers
              </p>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={newsletter.subject}
                    onChange={(e) => setNewsletter({ ...newsletter, subject: e.target.value })}
                    placeholder="Your newsletter subject..."
                    className="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Body (HTML supported)
                  </label>
                  <textarea
                    value={newsletter.body}
                    onChange={(e) => setNewsletter({ ...newsletter, body: e.target.value })}
                    rows={10}
                    placeholder="Your newsletter content... (HTML is supported)"
                    className="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowSendModal(false)}
                  disabled={sending}
                  className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendNewsletter}
                  disabled={sending || !newsletter.subject.trim() || !newsletter.body.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {sending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Sending...
                    </>
                  ) : (
                    `📧 Send to ${activeSubscribers.length} subscribers`
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Newsletter;
