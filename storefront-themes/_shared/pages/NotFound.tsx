import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface NotFoundProps {
  className?: string;
  accentColor?: string;
  heading?: string;
  message?: string;
  buttonText?: string;
}

const NotFound: React.FC<NotFoundProps> = ({
  className = '',
  accentColor,
  heading,
  message,
  buttonText,
}) => {
  const { t } = useTranslation(['errors']);

  return (
    <div className={`min-h-[60vh] flex items-center justify-center px-4 ${className}`}>
      <div className="text-center max-w-md">
        <div className="mb-6">
          <span className="text-8xl font-bold text-gray-200">404</span>
        </div>
        <h1 className="text-2xl font-bold mb-3">{heading || t('errors.not_found.title')}</h1>
        <p className="text-gray-500 mb-8">{message || t('errors.not_found.description')}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="inline-block px-6 py-3 rounded-lg text-white font-medium transition hover:opacity-90"
            style={{ backgroundColor: accentColor || 'var(--color-primary, #2563eb)' }}
          >
            {buttonText || t('errors.not_found.action.home')}
          </Link>
          <Link
            to="/products"
            className="inline-block px-6 py-3 rounded-lg border font-medium transition hover:bg-gray-50"
          >
            {t('errors.not_found.action.browse')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
