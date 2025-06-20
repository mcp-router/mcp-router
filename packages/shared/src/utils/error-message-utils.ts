/**
 * Error message parsing utilities for better user experience
 */

export interface ParsedError {
  isPaymentError: boolean;
  displayMessage: string;
  originalMessage: string;
  code?: string;
  purchaseUrl?: string;
}

/**
 * Parse error message to detect payment errors and extract user-friendly messages
 */
export function parseErrorMessage(errorMessage: string): ParsedError {
  const result: ParsedError = {
    isPaymentError: false,
    displayMessage: errorMessage,
    originalMessage: errorMessage,
  };

  try {
    // Try to parse as JSON for 402 errors
    const parsed = JSON.parse(errorMessage);
    
    if (parsed.code === 'insufficient_credits') {
      result.isPaymentError = true;
      result.code = parsed.code;
      result.displayMessage = parsed.message || 'クレジットが不足しています';
      result.purchaseUrl = 'https://mcp-router.net/profile';
      return result;
    }
    
    // Handle other JSON error formats
    if (parsed.message) {
      result.displayMessage = parsed.message;
    }
    
  } catch {
    // Not JSON, treat as plain text
    // Check if it's a 402 error by looking for HTTP status patterns
    if (errorMessage.includes('402') || errorMessage.toLowerCase().includes('payment required')) {
      result.isPaymentError = true;
      result.displayMessage = 'クレジットが不足しています';
      result.purchaseUrl = 'https://mcp-router.net/profile';
    }
  }

  return result;
}

/**
 * Get user-friendly error messages for common error types
 */
export function getFriendlyErrorMessage(error: Error): string {
  const parsed = parseErrorMessage(error.message);
  return parsed.displayMessage;
}