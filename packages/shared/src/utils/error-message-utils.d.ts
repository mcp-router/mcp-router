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
export declare function parseErrorMessage(errorMessage: string): ParsedError;
/**
 * Get user-friendly error messages for common error types
 */
export declare function getFriendlyErrorMessage(error: Error): string;
//# sourceMappingURL=error-message-utils.d.ts.map