import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

interface InvitationCodeProps {
  onActivate: (code: string) => Promise<boolean>;
}

export const InvitationCode: React.FC<InvitationCodeProps> = ({ onActivate }) => {
  const { t } = useTranslation();
  const [activationCode, setActivationCode] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    

    setIsSubmitting(true);
    setError(null);
    
    try {
      const success = await onActivate(activationCode.trim());
      
      if (!success) {
        setError(t('activation.invalidCode'));
      }
    } catch (err) {
      setError(t('activation.errorOccurred'));
      console.error('Activation error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      await onActivate('');
    } catch (err) {
      setError(t('activation.errorOccurred'));
      console.error('Activation error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-content-light">
      <Card className="w-[450px] shadow-lg">
        <CardHeader>
          <CardTitle>{t('activation.title')}</CardTitle>
          <CardDescription>{t('activation.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="activationCode">{t('activation.codeLabel')}</Label>
                <Input
                  id="activationCode"
                  placeholder={t('activation.codePlaceholder')}
                  value={activationCode}
                  onChange={(e) => setActivationCode(e.target.value)}
                  className="font-mono"
                />
              </div>
              
              {error && (
                <div className="text-red-500 text-sm">{error}</div>
              )}
              
              <div className="space-y-2">
                <Button 
                  type="submit"
                  className="w-full" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? t('activation.activating') : t('activation.activate')}
                </Button>
                
                <Button 
                  type="button"
                  variant="outline"
                  className="w-full" 
                  disabled={isSubmitting}
                  onClick={handleSkip}
                >
                  {t('activation.skip')}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default InvitationCode;
