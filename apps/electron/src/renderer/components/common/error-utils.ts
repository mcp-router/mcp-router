import { toast } from "sonner";
import { parseErrorMessage } from "@/renderer/utils/error-message-utils";

/**
 * Display server-specific error messages with enhanced context
 * @param error - The error object
 * @param serverName - The name of the server where the error occurred
 */
export function showServerError(error: Error, serverName?: string): void {
  const parsedError = parseErrorMessage(error.message);

  // Build the error message with server context
  let errorMessage = parsedError.displayMessage;

  if (serverName) {
    errorMessage = `${serverName}: ${errorMessage}`;
  }

  // Show appropriate toast based on error type
  if (parsedError.isPaymentError) {
    toast.error(errorMessage, {
      action: {
        label: "Purchase Credits",
        onClick: () => {
          if (parsedError.purchaseUrl) {
            window.open(parsedError.purchaseUrl, "_blank");
          }
        },
      },
      duration: 10000, // Show payment errors longer
    });
  } else {
    // For regular errors, show a standard toast
    toast.error(errorMessage, {
      duration: 5000,
    });
  }

  // Log the full error for debugging
  console.error("Server operation failed:", {
    serverName,
    originalError: error,
    parsedError,
  });
}
