import React from 'react';
import { useStore } from '../contexts/StoreContext';
import { useTranslation } from 'react-i18next';

interface AboutProps {
  className?: string;
  accentColor?: string;
  heading?: string;
  story?: string;
  values?: Array<{ title: string; description: string }>;
}

const About: React.FC<AboutProps> = ({
  className = '',
  accentColor,
  heading,
  story,
  values,
}) => {
  const { store } = useStore();
  const { t } = useTranslation(['footer']);

  const defaultValues = [
    { title: t('footer.about.value.quality_first_title'), description: t('footer.about.value.quality_first_description') },
    { title: t('footer.about.value.customer_focus_title'), description: t('footer.about.value.customer_focus_description') },
    { title: t('footer.about.value.transparency_title'), description: t('footer.about.value.transparency_description') },
  ];

  const resolvedValues = values || defaultValues;

  return (
    <div className={`max-w-4xl mx-auto px-4 sm:px-6 py-12 ${className}`}>
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-4">{heading || t('footer.about.title')}</h1>
        <p className="text-gray-500 max-w-2xl mx-auto leading-relaxed">
          {story || store?.description || t('footer.about.default_story', { name: store?.name || 'Our store' })}
        </p>
      </div>

      {/* Values */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        {resolvedValues.map((value, i) => (
          <div key={i} className="text-center p-6">
            <div
              className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: accentColor || 'var(--color-primary, #2563eb)' }}
            >
              {i + 1}
            </div>
            <h3 className="font-semibold mb-2">{value.title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{value.description}</p>
          </div>
        ))}
      </div>

      {/* Contact strip — only renders when the merchant has set the details.
          Avoids inventing fake "5000+ happy customers" stats. */}
      {(store?.email || store?.phone || store?.address) && (
        <div className="border-t border-b py-10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            {store?.email && (
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{t('footer.about.contact_email')}</p>
                <p className="text-sm font-medium">{store.email}</p>
              </div>
            )}
            {store?.phone && (
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{t('footer.about.contact_phone')}</p>
                <p className="text-sm font-medium">{store.phone}</p>
              </div>
            )}
            {store?.address && (
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{t('footer.about.contact_visit')}</p>
                <p className="text-sm font-medium">{store.address}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default About;
