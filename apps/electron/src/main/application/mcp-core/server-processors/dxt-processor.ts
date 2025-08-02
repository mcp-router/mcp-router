import { app } from "electron";
import {
  validateManifest,
  unpackExtension,
  DxtManifest,
} from "@anthropic-ai/dxt";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { MCPServerConfig } from "@mcp_router/shared";
import { convertDxtManifestToMCPServerConfig } from "./dxt-converter";

export async function processDxtFile(
  dxtFile: Uint8Array,
): Promise<MCPServerConfig> {
  // Create DXT directory
  const dxtDir = path.join(app.getPath("userData"), "mcp-servers", "dxt");
  if (!fs.existsSync(dxtDir)) {
    fs.mkdirSync(dxtDir, { recursive: true });
  }

  // Generate hash-based folder name for this DXT
  const hash = crypto
    .createHash("sha256")
    .update(dxtFile)
    .digest("hex")
    .substring(0, 16);
  const dxtFolder = path.join(dxtDir, hash);

  // Check if folder already exists (same DXT file)
  if (fs.existsSync(dxtFolder)) {
    // Remove existing folder to ensure clean installation
    fs.rmSync(dxtFolder, { recursive: true, force: true });
  }

  fs.mkdirSync(dxtFolder, { recursive: true });

  try {
    // Save DXT file
    const dxtPath = path.join(dxtFolder, "extension.dxt");
    const sourcePath = path.join(dxtFolder, "source");
    fs.writeFileSync(dxtPath, dxtFile);

    // Extract DXT file (it's a zip file)
    await unpackExtension({
      dxtPath,
      outputDir: sourcePath,
      silent: false,
    });

    // Read and validate manifest
    const manifestPath = path.join(sourcePath, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
      throw new Error("manifest.json not found in DXT file");
    }

    const manifestContent = fs.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(manifestContent) as DxtManifest;

    // Validate manifest
    const validationResult = validateManifest(manifestPath);
    if (!validationResult) {
      throw new Error(`Invalid manifest`);
    }

    // Convert manifest to MCPServerConfig
    return convertDxtManifestToMCPServerConfig(manifest, sourcePath, hash);
  } catch (error) {
    // Clean up on error
    if (fs.existsSync(dxtFolder)) {
      fs.rmSync(dxtFolder, { recursive: true, force: true });
    }
    throw error;
  }
}
