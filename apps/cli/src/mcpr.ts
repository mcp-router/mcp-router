#!/usr/bin/env node
import { executeConnect } from "./commands/connect.js";
import { executeServe } from "./commands/serve.js";

export const VERSION = "0.1.6";
export const SERVER_NAME = "MCP Router";

// Parse command-line arguments
const args = process.argv.slice(2);
const command = args[0] || "connect";
const commandArgs = args.slice(1);

// Execute the appropriate command based on the input
async function main() {
  try {
    switch (command) {
      case "connect":
        await executeConnect(commandArgs);
        break;
      case "serve":
        await executeServe(commandArgs);
        break;
      default:
        await executeConnect(args);
        break;
    }
  } catch (error) {
    console.error("Error executing command:", error);
    process.exit(1);
  }
}

// Run the main function
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
