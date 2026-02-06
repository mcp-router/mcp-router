import React from "react";
import { useTranslation } from "react-i18next";
import { Card, Badge } from "@mcp_router/ui";
import { cn } from "@/renderer/utils/tailwind-utils";
import type { UnifiedSkill } from "@mcp_router/shared";
import { ClientStatusIcon } from "./ClientStatusIcon";

/**
 * Props for UnifiedSkillCard component
 */
interface UnifiedSkillCardProps {
  /** The unified skill data to display */
  skill: UnifiedSkill;
  /** Callback when the card is clicked */
  onClick: () => void;
}

/**
 * Extracts a description excerpt from SKILL.md content.
 * Looks for the first paragraph after any heading, or returns the first
 * non-empty lines if no clear structure is found.
 */
function extractDescriptionFromSkillMd(content: string | null): string {
  if (!content) {
    return "";
  }

  const lines = content.split("\n");
  const descriptionLines: string[] = [];
  let foundContent = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines at the start
    if (!foundContent && trimmedLine === "") {
      continue;
    }

    // Skip headings (lines starting with #)
    if (trimmedLine.startsWith("#")) {
      // If we already collected some content, stop here
      if (descriptionLines.length > 0) {
        break;
      }
      continue;
    }

    // Skip frontmatter markers
    if (trimmedLine === "---") {
      continue;
    }

    // Skip code block markers
    if (trimmedLine.startsWith("```")) {
      if (descriptionLines.length > 0) {
        break;
      }
      continue;
    }

    // Found actual content
    if (trimmedLine !== "") {
      foundContent = true;
      descriptionLines.push(trimmedLine);

      // Collect up to 3 lines for the excerpt
      if (descriptionLines.length >= 3) {
        break;
      }
    } else if (foundContent && descriptionLines.length > 0) {
      // Empty line after content means end of paragraph
      break;
    }
  }

  return descriptionLines.join(" ");
}

/**
 * UnifiedSkillCard displays a skill in the unified skills library.
 *
 * The card shows:
 * - Skill name with optional DISCOVERED badge (top)
 * - Description excerpt from SKILL.md - 2 lines, truncated (middle)
 * - Row of client icons showing installation/enabled status per client (bottom)
 *
 * Client Icon States:
 * - Enabled: Client icon colored with small green dot overlay
 * - Disabled: Client icon colored, no dot
 * - Not Installed: Client icon grayed out/faded
 *
 * @example
 * ```tsx
 * <UnifiedSkillCard
 *   skill={unifiedSkill}
 *   onClick={() => openSkillDetails(unifiedSkill.id)}
 * />
 * ```
 */
export const UnifiedSkillCard: React.FC<UnifiedSkillCardProps> = ({
  skill,
  onClick,
}) => {
  const { t } = useTranslation();

  // Extract description from SKILL.md content
  const description = extractDescriptionFromSkillMd(skill.content);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  // Filter to only show installed clients (enabled or disabled), sorted by state
  const installedClientStates = [...skill.clientStates]
    .filter((cs) => cs.state === "enabled" || cs.state === "disabled")
    .sort((a, b) => {
      // Enabled first, then disabled
      if (a.state === "enabled" && b.state !== "enabled") return -1;
      if (a.state !== "enabled" && b.state === "enabled") return 1;
      return 0;
    });

  return (
    <Card
      className={cn(
        "flex flex-col cursor-pointer transition-all duration-300 ease-in-out",
        "bg-card/40 hover:bg-card border-border/40 hover:border-primary/40",
        "hover:shadow-xl soft-shadow hover:-translate-y-1.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
        "p-7 rounded-[2rem]",
      )}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={t("skills.unified.viewDetails", {
        name: skill.name,
        defaultValue: `View details for ${skill.name}`,
      })}
    >
      {/* Top: Skill name + DISCOVERED badge */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <h3 className="font-extrabold text-lg leading-tight truncate flex-1 tracking-tight">
          {skill.name}
        </h3>
        {skill.source === "discovered" && (
          <Badge
            variant="secondary"
            className="text-[10px] px-2.5 py-1 shrink-0 uppercase tracking-widest font-black rounded-full bg-blue-500/10 text-blue-600 border-blue-500/20"
          >
            {t("skills.unified.discovered", { defaultValue: "Found" })}
          </Badge>
        )}
      </div>

      {/* Middle: Description excerpt (2 lines) */}
      <p
        className={cn(
          "text-sm text-muted-foreground/80 line-clamp-3 flex-1 min-h-[3.75rem] leading-relaxed",
          !description && "italic opacity-40",
        )}
      >
        {description ||
          t("skills.unified.noDescription", {
            defaultValue: "No description found in SKILL.md",
          })}
      </p>

      {/* Bottom: Client status icons - only show installed/enabled clients */}
      {installedClientStates.length > 0 && (
        <div
          className="flex items-center flex-wrap gap-1.5 mt-6 pt-5 border-t border-border/20"
          aria-label={t("skills.unified.clientStates", {
            defaultValue: "Client installation states",
          })}
        >
          {installedClientStates.slice(0, 8).map((clientState) => (
            <div
              key={clientState.clientId}
              className="bg-muted/40 p-1.5 rounded-full transition-transform hover:scale-110"
            >
              <ClientStatusIcon
                clientId={clientState.clientId}
                clientIcon={clientState.clientIcon}
                clientName={clientState.clientName}
                state={clientState.state}
                size="sm"
                showTooltip
              />
            </div>
          ))}
          {installedClientStates.length > 8 && (
            <span className="text-[10px] font-black text-primary ml-1 bg-primary/10 px-2 py-1 rounded-full uppercase">
              +{installedClientStates.length - 8}
            </span>
          )}
        </div>
      )}
    </Card>
  );
};