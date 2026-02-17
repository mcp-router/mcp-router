import { app } from "electron";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { MCPServerConfig } from "@mcp_router/shared";
import { convertMcpbManifestToMCPServerConfig } from "./mcpb-converter";

/**
 * MCPB v0.3 manifest interface.
 * Based on https://github.com/modelcontextprotocol/mcpb
 */
export interface McpbManifest {
  manifest_version: string;
  name: string;
  display_name?: string;
  version: string;
  description: string;
  author?: {
    name: string;
    url?: string;
    email?: string;
  };
  homepage?: string;
  repository?: string;
  license?: string;
  server: {
    type: "stdio" | "node" | "python" | "uv";
    mcp_config: {
      command: string;
      args?: string[];
      env?: Record<string, string>;
      platform_overrides?: Record<
        string,
        {
          command?: string;
          args?: string[];
          env?: Record<string, string>;
        }
      >;
    };
    runtime?: {
      node?: string;
      python?: string;
    };
  };
  compatibility?: {
    platforms?: Array<"darwin" | "win32" | "linux">;
    mcp_versions?: string[];
  };
  user_config?: Record<
    string,
    {
      type: string;
      title?: string;
      description?: string;
      sensitive?: boolean;
      required?: boolean;
      default?: string;
      min?: number;
      max?: number;
    }
  >;
  icon?: string;
  categories?: string[];
  tags?: string[];
}

/**
 * Process a .mcpb file and return an MCPServerConfig.
 * MCPB files are zip archives containing a manifest.json and server files.
 */
export async function processMcpbFile(
  mcpbFile: Uint8Array,
): Promise<MCPServerConfig> {
  const mcpbDir = path.join(app.getPath("userData"), "mcp-servers", "mcpb");
  if (!fs.existsSync(mcpbDir)) {
    fs.mkdirSync(mcpbDir, { recursive: true });
  }

  const hash = crypto
    .createHash("sha256")
    .update(mcpbFile)
    .digest("hex")
    .substring(0, 16);
  const mcpbFolder = path.join(mcpbDir, hash);

  if (fs.existsSync(mcpbFolder)) {
    fs.rmSync(mcpbFolder, { recursive: true, force: true });
  }

  fs.mkdirSync(mcpbFolder, { recursive: true });

  try {
    const bundlePath = path.join(mcpbFolder, "extension.mcpb");
    const sourcePath = path.join(mcpbFolder, "source");
    fs.writeFileSync(bundlePath, mcpbFile);

    // Extract the zip archive
    // MCPB files may have a signature block prefix — find the zip start (PK header)
    let zipData = mcpbFile;
    const pkSignature = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    const pkOffset = findBytes(mcpbFile, pkSignature);
    if (pkOffset > 0) {
      zipData = mcpbFile.slice(pkOffset);
    }

    await extractZip(zipData, sourcePath);

    // Read and validate manifest
    const manifestPath = path.join(sourcePath, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
      throw new Error("manifest.json not found in MCPB file");
    }

    const manifestContent = fs.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(manifestContent) as McpbManifest;

    validateMcpbManifest(manifest);

    return convertMcpbManifestToMCPServerConfig(manifest, sourcePath);
  } catch (error) {
    if (fs.existsSync(mcpbFolder)) {
      fs.rmSync(mcpbFolder, { recursive: true, force: true });
    }
    throw error;
  }
}

function validateMcpbManifest(manifest: McpbManifest): void {
  if (!manifest.name) throw new Error("MCPB manifest missing required field: name");
  if (!manifest.version) throw new Error("MCPB manifest missing required field: version");
  if (!manifest.description) throw new Error("MCPB manifest missing required field: description");
  if (!manifest.server?.mcp_config?.command) {
    throw new Error("MCPB manifest missing required field: server.mcp_config.command");
  }

  const validVersion = manifest.manifest_version;
  if (!validVersion) {
    throw new Error("MCPB manifest missing required field: manifest_version");
  }
}

function findBytes(haystack: Uint8Array, needle: Uint8Array): number {
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

/**
 * Extract a zip archive using fflate (already available as a dependency).
 * Includes zip-slip prevention.
 */
async function extractZip(
  zipData: Uint8Array,
  outputDir: string,
): Promise<void> {
  // Use dynamic import for fflate's unzip
  const { unzipSync } = await import("fflate");
  const files = unzipSync(zipData);

  const resolvedOutput = path.resolve(outputDir);

  for (const [filePath, content] of Object.entries(files)) {
    // Zip-slip prevention
    const resolvedPath = path.resolve(outputDir, filePath);
    if (!resolvedPath.startsWith(resolvedOutput + path.sep) && resolvedPath !== resolvedOutput) {
      throw new Error(`Zip-slip attack detected: ${filePath}`);
    }

    if (filePath.endsWith("/")) {
      fs.mkdirSync(resolvedPath, { recursive: true });
    } else {
      fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
      fs.writeFileSync(resolvedPath, content);
    }
  }
}
