import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

/**
 * Hook to modify the .desktop file after MakerDeb creates it
 * This adds MimeType and ensures %u is in the Exec line for protocol handling
 */
export async function postMake(
  forgeConfig: any,
  makeResults: Array<{ artifacts: string[]; platform: string; arch: string }>,
): Promise<void> {
  // Only process Linux builds
  const linuxResults = makeResults.filter(
    (result) => result.platform === "linux",
  );

  for (const result of linuxResults) {
    for (const artifact of result.artifacts) {
      // Check if this is a .deb file
      if (artifact.endsWith(".deb")) {
        try {
          console.log(`[postMake] Modifying .deb file: ${artifact}`);
          
          // Create a temporary directory for extraction
          const tempDir = path.join(path.dirname(artifact), "temp_deb_extract");
          if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
          }
          fs.mkdirSync(tempDir, { recursive: true });

          // Extract the .deb file
          execSync(`dpkg-deb -x "${artifact}" "${tempDir}"`, { stdio: "inherit" });
          execSync(`dpkg-deb -e "${artifact}" "${tempDir}/DEBIAN"`, { stdio: "inherit" });

          // Find and modify the .desktop file
          const desktopFile = path.join(
            tempDir,
            "usr",
            "share",
            "applications",
            "mcp-router.desktop",
          );

          if (fs.existsSync(desktopFile)) {
            let desktopContent = fs.readFileSync(desktopFile, "utf-8");
            
            // Ensure Exec line contains %u for URL parameter
            if (!desktopContent.includes("Exec=") || !desktopContent.match(/Exec=.*%u/)) {
              desktopContent = desktopContent.replace(
                /Exec=(.+)/,
                (match, execLine) => {
                  // Add %u if not present
                  if (!execLine.includes("%u")) {
                    return `Exec=${execLine.trim()} %u`;
                  }
                  return match;
                },
              );
            }

            // Add MimeType if not present
            if (!desktopContent.includes("MimeType=")) {
              // Add after Type=Application line
              desktopContent = desktopContent.replace(
                /(Type=Application\n)/,
                "$1MimeType=x-scheme-handler/mcpr;\n",
              );
            } else if (!desktopContent.includes("x-scheme-handler/mcpr")) {
              // Add to existing MimeType line
              desktopContent = desktopContent.replace(
                /MimeType=(.+)/,
                (match, mimeTypes) => {
                  if (!mimeTypes.includes("x-scheme-handler/mcpr")) {
                    return `MimeType=${mimeTypes.trim()};x-scheme-handler/mcpr;`;
                  }
                  return match;
                },
              );
            }

            fs.writeFileSync(desktopFile, desktopContent, "utf-8");
            console.log(`[postMake] Updated .desktop file with protocol handler`);

            // Repackage the .deb file
            execSync(
              `dpkg-deb -b "${tempDir}" "${artifact}"`,
              { stdio: "inherit" },
            );

            // Clean up
            fs.rmSync(tempDir, { recursive: true, force: true });
            console.log(`[postMake] Successfully modified .deb file`);
          } else {
            console.warn(`[postMake] .desktop file not found at: ${desktopFile}`);
            fs.rmSync(tempDir, { recursive: true, force: true });
          }
        } catch (error) {
          console.error(`[postMake] Error modifying .deb file:`, error);
        }
      }
    }
  }
}
