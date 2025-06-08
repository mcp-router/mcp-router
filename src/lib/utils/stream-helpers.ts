// Helper functions for streaming API calls
export const streamResponseHandler = async (
  response: Response, 
  onChunk: (chunk: string) => void, 
  onError: (error: Error) => void,
  onComplete?: () => void
) => {
  try {
    // Check if response is ok
    if (!response.ok) {
      throw new Error(`API request failed with status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    // Process the stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let accumulatedContent = '';

    while (!done) {
      const { value, done: streamDone } = await reader.read();
      done = streamDone;

      if (value) {
        const chunk = decoder.decode(value, { stream: !done });
        accumulatedContent += chunk;
        onChunk(accumulatedContent);
      }
    }

    if (onComplete) {
      onComplete();
    }
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      console.error('Stream processing error:', error);
      onError(error as Error);
    }
  }
};
