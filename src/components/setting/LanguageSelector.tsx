import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const LanguageSelector: React.FC = () => {
  const { i18n, t } = useTranslation();
  const [currentLang, setCurrentLang] = useState(i18n.language || 'en');

  useEffect(() => {
    // Set default language if not set or invalid
    if (!i18n.language || (i18n.language !== 'en' && i18n.language !== 'ja')) {
      i18n.changeLanguage('en');
      setCurrentLang('en');
    } else {
      setCurrentLang(i18n.language);
    }
  }, [i18n]);

  const changeLanguage = (language: string) => {
    i18n.changeLanguage(language);
    setCurrentLang(language);
  };

  return (
    <div className="flex items-center">
      <Select
        value={currentLang}
        onValueChange={changeLanguage}
      >
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder={"Select"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="en">{t('languages.en')}</SelectItem>
          <SelectItem value="ja">{t('languages.ja')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

export default LanguageSelector;
