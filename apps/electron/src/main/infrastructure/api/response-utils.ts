/**
 * Utilities for handling and summarizing response data
 */

/**
 * Create a summarized version of response data for logging
 * @param response The response object to summarize
 * @returns A summarized version of the response suitable for logging
 */
export function summarizeResponse(response: any): any {
  if (!response) return null;

  // Maximum response size for detailed logging (5MB)
  const MAX_RESPONSE_SIZE = 10 * 1024 * 1024;

  try {
    // Create a stringified version to check size
    const responseString = JSON.stringify(response);

    // Only summarize if the response is too large
    if (responseString.length > MAX_RESPONSE_SIZE) {
      // Create summary for arrays
      if (Array.isArray(response)) {
        const sampleItems = response.slice(0, 3);
        return {
          _originalSize: responseString.length,
          _summary: `Array with ${response.length} items (showing first 3 as sample)`,
          _sample: sampleItems,
          _fullDataAvailable: false,
        };
      }

      // Create summary for objects
      if (typeof response === "object") {
        const summaryObj: Record<string, any> = {
          _originalSize: responseString.length,
          _summary: "Large object data (showing structure and sample)",
          _fullDataAvailable: false,
        };

        // Process specific collection types
        const collectionTypes = [
          "tools",
          "resources",
          "resourceTemplates",
          "prompts",
          "contents",
        ];

        for (const collectionType of collectionTypes) {
          if (
            collectionType in response &&
            Array.isArray(response[collectionType])
          ) {
            summaryObj[collectionType] = {
              count: response[collectionType].length,
              sample: response[collectionType].slice(0, 3),
            };
          }
        }

        // Add all keys for reference
        summaryObj._keys = Object.keys(response);

        // Add sample data for remaining fields
        const sampleData: Record<string, any> = {};
        for (const key of Object.keys(response)) {
          if (!collectionTypes.includes(key)) {
            const value = response[key];

            if (Array.isArray(value)) {
              sampleData[key] =
                value.length > 0
                  ? {
                      type: "array",
                      length: value.length,
                      sample: value.slice(0, 2),
                    }
                  : { type: "array", length: 0 };
            } else if (typeof value === "object" && value !== null) {
              sampleData[key] = { type: "object", keys: Object.keys(value) };
            } else {
              // Preserve primitive values
              sampleData[key] = value;
            }
          }
        }

        summaryObj._sampleData = sampleData;
        return summaryObj;
      }

      // Default summary for other types (like strings)
      return {
        _originalSize: responseString.length,
        _summary: `Large data of type ${typeof response} (${responseString.length} bytes)`,
        _sample:
          typeof response === "string"
            ? response.substring(0, 1000) + "..."
            : response,
        _fullDataAvailable: false,
      };
    }

    // Return complete response if within size limits
    return response;
  } catch (error) {
    console.error("Error during response summarization:", error);
    // Return original response if summarization fails
    return response;
  }
}
