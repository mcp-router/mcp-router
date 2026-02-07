/**
 * Type definitions for Skills marketplace components
 */

/**
 * Represents a skill available in the marketplace
 */
export interface MarketplaceSkill {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  installCount: number;
  rating?: number;
  tags: string[];
  repositoryUrl?: string;
  compatibility: SkillCompatibility[];
}

/**
 * Supported AI clients for skill compatibility
 */
export type SkillCompatibility =
  | "claude-code"
  | "cursor"
  | "windsurf"
  | "cline"
  | "roo-code";

/**
 * Sort options for the skills grid
 */
export type SkillSortOption = "downloads" | "name" | "nameDesc";

/**
 * Props for the SkillsGrid component
 */
export interface SkillsGridProps {
  searchQuery: string;
  className?: string;
}

/**
 * Props for the SkillCard component
 */
export interface SkillCardProps {
  skill: MarketplaceSkill;
  isInstalled: boolean;
  onInstall: (skill: MarketplaceSkill) => Promise<void>;
  onViewDetails: (skill: MarketplaceSkill) => void;
}

/**
 * Props for the SkillDetailsModal component
 */
export interface SkillDetailsModalProps {
  skill: MarketplaceSkill | null;
  isOpen: boolean;
  onClose: () => void;
  isInstalled: boolean;
  onInstall: (skill: MarketplaceSkill) => Promise<void>;
  readmeContent?: string | null;
  isLoadingReadme?: boolean;
}

