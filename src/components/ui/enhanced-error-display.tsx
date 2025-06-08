import React from 'react';
import { AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from './button';
import { parseErrorMessage } from '../../lib/utils/error-message-utils';

interface EnhancedErrorDisplayProps {
  error: Error;
  className?: string;
}

/**
 * Enhanced error display component that shows user-friendly messages
 * and purchase buttons for payment-related errors
 */
export const EnhancedErrorDisplay: React.FC<EnhancedErrorDisplayProps> = ({ 
  error, 
  className = "" 
}) => {
  const parsedError = parseErrorMessage(error.message);

  const handlePurchaseClick = () => {
    if (parsedError.purchaseUrl) {
      window.open(parsedError.purchaseUrl, '_blank');
    }
  };

  return (
    <div className={`bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-md shadow-sm ${className}`}>
      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <div className="font-medium">エラー</div>
          <div className="text-xs mt-1 text-red-600">
            {parsedError.displayMessage}
          </div>
          
          {parsedError.isPaymentError && parsedError.purchaseUrl && (
            <div className="mt-2">
              <Button 
                size="sm" 
                className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1"
                onClick={handlePurchaseClick}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                クレジットを購入
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};