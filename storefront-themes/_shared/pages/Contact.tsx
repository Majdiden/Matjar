import React, { useState } from 'react';
import { useStore } from '../contexts/StoreContext';
import { contactApi } from '../api/client';

interface ContactProps {
  className?: string;
  accentColor?: string;
  heading?: string;
  subheading?: string;
}

const SUBJECTS = [
  'General Inquiry',
  'Order Support',
  'Returns & Exchanges',
  'Product Question',
  'Other',
];

const Contact: React.FC<ContactProps> = ({
  className = '',
  accentColor,
  heading = 'Contact Us',
  subheading = "Have a question or need help? We'd love to hear from you.",
}) => {
  const { store } = useStore();
  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: SUBJECTS[0],
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ringColor = accentColor || 'var(--color-primary, #2563eb)';

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.message.trim().length < 10) {
      setError('Please write at least 10 characters in your message.');
      return;
    }

    setSubmitting(true);
    try {
      await contactApi.send({
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject,
        message: form.message.trim(),
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || 'Could not send your message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`max-w-4xl mx-auto px-4 sm:px-6 py-12 ${className}`}>
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold mb-2">{heading}</h1>
        <p className="text-gray-500">{subheading}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Contact Info */}
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold mb-2">Store</h3>
            <p className="text-gray-600 text-sm">{store?.name || 'Our Store'}</p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Email</h3>
            <p className="text-gray-600 text-sm">{store?.email || 'support@store.com'}</p>
          </div>
          {store?.phone && (
            <div>
              <h3 className="font-semibold mb-2">Phone</h3>
              <p className="text-gray-600 text-sm">{store.phone}</p>
            </div>
          )}
          {store?.address && (
            <div>
              <h3 className="font-semibold mb-2">Address</h3>
              <p className="text-gray-600 text-sm">{store.address}</p>
            </div>
          )}
          <div>
            <h3 className="font-semibold mb-2">Hours</h3>
            <p className="text-gray-600 text-sm">Monday - Friday: 9am - 6pm</p>
            <p className="text-gray-600 text-sm">Saturday - Sunday: 10am - 4pm</p>
          </div>
        </div>

        {/* Contact Form */}
        {submitted ? (
          <div className="flex items-center justify-center">
            <div className="text-center">
              <svg
                className="w-12 h-12 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                style={{ color: ringColor }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="text-xl font-semibold mb-2">Message Sent</h3>
              <p className="text-gray-500">We'll get back to you within 24 hours.</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                name="name"
                type="text"
                required
                value={form.name}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': ringColor } as React.CSSProperties}
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                name="email"
                type="email"
                required
                value={form.email}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2"
                placeholder="your@email.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Subject</label>
              <select
                name="subject"
                value={form.subject}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2"
              >
                {SUBJECTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Message</label>
              <textarea
                name="message"
                required
                rows={5}
                value={form.message}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 resize-none"
                placeholder="How can we help you?"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-lg text-white font-medium transition hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: ringColor }}
            >
              {submitting ? 'Sending…' : 'Send Message'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Contact;
