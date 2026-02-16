# MCP Hook API Reference

## Overview

The MCP Router Hook system is an extension feature that allows custom logic to be executed before and after MCP request processing. Hook scripts written in JavaScript are executed safely in a sandboxed environment.

## Hook Execution Timing

### Pre-hook
- Executed **before** the MCP request is sent to the server
- Can validate, modify, or block requests
- Used for authentication/authorization, rate limiting, request transformation, etc.

### Post-hook
- Executed **after** receiving the response from the MCP server
- Can validate, modify, and log responses
- Used for metrics collection, response transformation, notifications, etc.

## Script Execution Environment

### Available Global Variables

#### `context` (HookContext)
An object containing information about the current request/response:

```typescript
interface HookContext {
  // Pure MCP request
  request: {
    method: string;        // MCP method name ("tools/call", "tools/list", etc.)
    params: any;           // MCP protocol parameters
  };

  // Pure MCP response (available only in Post-hook)
  response?: any;          // Response from the server

  // Workflow execution context (passed by workflow-executor.ts)
  workflowId: string;      // ID of the current workflow
  workflowName: string;    // Name of the current workflow
  nodeId: string;          // ID of the current hook node
  nodeName: string;        // Name/label of the current hook node
  previousResults: any[];  // Results from previous nodes in the workflow

  // Application-specific metadata
  metadata: {
    // Server information (optional)
    serverName?: string;   // Server name

    // Error information
    error?: Error;         // Error information (Post-hook only)

    // WARNING: NOT IMPLEMENTED - Planned for future release.
    // clientId: string;              // Client ID - not currently passed
    // serverId?: string;             // Server ID - not currently passed
    // shared?: Record<string, any>;  // Shared data between Hooks - not currently implemented
  };
}
```

#### `console`
Object for log output:
- `console.log(...args)` - Information log
- `console.warn(...args)` - Warning log
- `console.error(...args)` - Error log

### Available Utility Functions

#### `sleep(ms: number): Promise<void>` - IMPLEMENTED
Pauses processing for the specified number of milliseconds. The delay is capped at 5000ms to stay within the hook timeout.

```javascript
await sleep(1000); // Wait 1 second
await sleep(10000); // Capped to 5000ms
```

#### `getServerInfo(serverId: string): object | null` - IMPLEMENTED
Returns basic server metadata. Returns `null` if the server is not found. Does not expose sensitive data (tokens, URLs, environment variables).

```javascript
const serverInfo = getServerInfo(context.metadata.serverId);
if (serverInfo) {
  console.log("Server:", serverInfo.name, "Status:", serverInfo.status);
}
// Returns: { id, name, type, status, enabled }
```

#### `fetch(url: string, options?: object): Promise<Response>` - NOT IMPLEMENTED (needs security review)
Sends HTTPS requests. For security reasons, the following restrictions apply:
- Only HTTPS URLs are allowed (HTTP is not allowed)
- Timeout is 3 seconds
- cookie and authorization headers are automatically removed

```javascript
// NOT AVAILABLE IN CURRENT SANDBOX
// GET request
const response = await fetch('https://api.example.com/data');
const data = await response.json();

// POST request
const response = await fetch('https://api.example.com/validate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ key: 'value' })
});

// Response object
// {
//   ok: boolean,
//   status: number,
//   statusText: string,
//   headers: object,
//   text: () => Promise<string>,
//   json: () => Promise<any>
// }
```

## Script Return Value

Hook scripts must return an object in `HookResult` format:

```typescript
interface HookResult {
  // Whether to continue processing
  continue: boolean;

  // Modified context (optional)
  // If specified, the request passed to the next Hook or MCP server will be updated
  context?: HookContext;

  // Error information when an error occurs
  error?: {
    code: string;      // Error code
    message: string;   // Error message
  };
}
```

> **WARNING: NOT IMPLEMENTED** - Return values are not currently validated for flow control. The `continue: false` flag and `error` object are captured but may not halt workflow execution in all cases. This behavior is planned for future enhancement.

## Sample Code

### 1. Request Modification (Pre-hook)

```javascript
// Add custom parameters to specific tool calls
if (context.request.method === "tools/call" && context.request.params.name === "search") {
  // Modify request parameters
  const modifiedContext = {
    ...context,
    request: {
      ...context.request,
      params: {
        ...context.request.params,
        maxResults: 10,  // Limit maximum results
        language: "ja"   // Fix language to Japanese
      }
    }
  };

  return {
    continue: true,
    context: modifiedContext
  };
}

return { continue: true };
```

### 2. Rate Limiting (Pre-hook)

```javascript
// Implement rate limiting using metadata
const rateLimit = context.metadata.shared?.rateLimit || {};
const clientKey = `${context.metadata.clientId}_${context.request.method}`;
const now = Date.now();

// Check last request time
const lastRequest = rateLimit[clientKey];
if (lastRequest && (now - lastRequest) < 1000) {  // Within 1 second
  return {
    continue: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests. Please retry after 1 second."
    }
  };
}

// Record latest request time
rateLimit[clientKey] = now;

return {
  continue: true,
  context: {
    ...context,
    metadata: {
      ...context.metadata,
      shared: {
        ...context.metadata.shared,
        rateLimit
      }
    }
  }
};
```

### 3. Response Logging (Post-hook)

```javascript
// Log response size
const responseSize = JSON.stringify(context.response || {}).length;
console.log(`Request completed:`, {
  method: context.request.method,
  server: context.metadata.serverName,
  tool: context.request.params?.name,  // For tools/call
  responseSize: responseSize,
  hasError: !!context.metadata.error
});

// Log details if error
if (context.metadata.error) {
  console.error("Request failed:", context.metadata.error);
}

// Continue processing
return { continue: true };
```

### 4. Response Transformation (Post-hook)

```javascript
// Filter tool responses
if (context.request.method === "tools/list" && context.response) {
  // Exclude specific tools
  const filteredTools = context.response.tools.filter(tool => {
    return !tool.name.startsWith("internal_");
  });

  const modifiedContext = {
    ...context,
    response: {
      ...context.response,
      tools: filteredTools
    }
  };

  return {
    continue: true,
    context: modifiedContext
  };
}

return { continue: true };
```

### 5. Conditional Execution

```javascript
// Execute only for specific servers
const targetServers = ["production-server", "staging-server"];
if (!targetServers.includes(context.metadata.serverName)) {
  // Do nothing for this server
  return { continue: true };
}

// Restrict access outside business hours
const now = new Date();
const hour = now.getHours();
if (hour < 9 || hour >= 18) {
  return {
    continue: false,
    error: {
      code: "OUTSIDE_BUSINESS_HOURS",
      message: "Outside business hours (9:00-18:00)"
    }
  };
}

return { continue: true };
```

### 6. External API Validation (Gemini API Example)

```javascript
// Request validation using Gemini API
const API_KEY = "YOUR_API_KEY"; // Recommended to get from environment variables
const API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent";

try {
  const requestBody = {
    system_instruction: {
      parts: {
        text: "Please validate the security of the MCP request. " +
              'Respond in {"safe": boolean, "reason": string} format.'
      }
    },
    contents: [{
      parts: [{
        text: "Request information: " + JSON.stringify({
          type: context.requestType,
          server: context.serverName,
          tool: context.toolName,
          params: context.request.params
        })
      }]
    }],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(API_ENDPOINT + "?key=" + API_KEY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
  });

  if (response.ok) {
    const result = await response.json();
    const validation = JSON.parse(
      result.candidates?.[0]?.content?.parts?.[0]?.text || "{}"
    );

    if (!validation.safe) {
      return {
        continue: false,
        error: {
          code: "API_VALIDATION_FAILED",
          message: validation.reason
        }
      };
    }
  }
} catch (error) {
  console.error("API validation error:", error);
  // Fallback processing on error
}

return { continue: true };
```

## Error Handling

### Script Errors
When an error occurs within a script, it is automatically returned in the following format:

```javascript
{
  continue: false,
  error: {
    code: "SCRIPT_ERROR",
    message: "Error message"
  }
}
```

### Timeout
Script execution time is limited to 5 seconds. When timeout occurs:

```javascript
{
  continue: false,
  error: {
    code: "TIMEOUT",
    message: "Script execution timed out"
  }
}
```

## Best Practices

1. **Early Return**: Return `{ continue: true }` early if conditions are not met
2. **Error Handling**: Handle errors appropriately with try-catch
3. **Performance**: Avoid heavy processing (5 second timeout)
4. **Log Output**: Output appropriate debug information to logs
5. **Metadata Utilization**: Use metadata for data sharing between Hooks

## Limitations

- External API access is restricted
- File system access is not allowed
- Node.js module imports are not allowed
- Maximum execution time is 5 seconds
- Infinite loops are automatically terminated
