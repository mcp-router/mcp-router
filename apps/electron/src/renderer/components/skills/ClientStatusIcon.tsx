import React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@mcp_router/ui";
import { IconApps } from "@tabler/icons-react";
import { sanitizeSvgWithStyles } from "@/renderer/utils/svg-sanitizer";

interface ClientStatusIconProps {
  clientId: string;
  clientName: string;
  clientIcon?: string;
  state: "enabled" | "disabled" | "not-installed";
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
}

const sizeMap = {
  sm: 14,
  md: 18,
  lg: 22,
} as const;

const dotSizeMap = {
  sm: 5,
  md: 6,
  lg: 7,
} as const;

export const ClientStatusIcon: React.FC<ClientStatusIconProps> = ({
  clientId,
  clientName,
  clientIcon,
  state,
  size = "md",
  showTooltip = false,
}) => {
  const iconSize = sizeMap[size];
  const dotSize = dotSizeMap[size];

  const isEnabled = state === "enabled";
  const isNotInstalled = state === "not-installed";

  const renderIcon = () => {
    if (clientIcon && clientIcon.includes("<svg")) {
      // Force currentColor and sanitize SVG content
      const themedSvg = clientIcon
        .replace(/fill="[^"]*"/g, 'fill="currentColor"')
        .replace(/stroke="[^"]*"/g, 'stroke="currentColor"');

      // Sanitize SVG content to prevent XSS and inject size styles
      const sanitizedSvg = sanitizeSvgWithStyles(
        themedSvg,
        `width: ${iconSize}px; height: ${iconSize}px;`,
      );

      if (!sanitizedSvg) {
        // If sanitization fails, fall back to default icon
        return (
          <IconApps
            style={{ width: iconSize, height: iconSize }}
            className="text-muted-foreground"
          />
        );
      }

      return (
        <div
          className="flex items-center justify-center [&_svg]:w-full [&_svg]:h-full text-foreground [&_path]:fill-current [&_circle]:fill-current [&_rect]:fill-current [&_ellipse]:fill-current [&_polygon]:fill-current"
          style={{ width: iconSize, height: iconSize }}
          dangerouslySetInnerHTML={{ __html: sanitizedSvg }}
        />
      );
    }

    // Fallback icon when no client icon is provided
    return (
      <IconApps
        style={{ width: iconSize, height: iconSize }}
        className="text-muted-foreground"
      />
    );
  };

  const iconContent = (
    <div
      className="relative inline-flex"
      style={{ width: iconSize, height: iconSize }}
      data-client-id={clientId}
    >
      {/* Icon container with opacity for not-installed state */}
      <div
        className={isNotInstalled ? "opacity-40" : ""}
        style={{ width: iconSize, height: iconSize }}
      >
        {renderIcon()}
      </div>

      {/* Status dot for enabled state */}
      {isEnabled && (
        <div
          className="absolute bg-emerald-500 rounded-full border border-background shadow-sm"
          style={{
            width: dotSize,
            height: dotSize,
            bottom: -1,
            right: -1,
          }}
        />
      )}
    </div>
  );

  if (showTooltip) {
    const tooltipText =
      state === "enabled"
        ? `Enabled in ${clientName}`
        : state === "disabled"
          ? `Disabled in ${clientName}`
          : `Not installed in ${clientName}`;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-default">{iconContent}</span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return iconContent;
};