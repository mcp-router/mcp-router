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
  createdAt: string;
  updatedAt: string;
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
export type SkillSortOption = "popular" | "trending" | "recent";

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

/**
 * Mock data for development until backend is ready
 */
const MOCK_MARKETPLACE_SKILLS: MarketplaceSkill[] = [
  {
    id: "skill-1",
    name: "code-review",
    description:
      "Comprehensive code review skill that analyzes code quality, security vulnerabilities, and provides actionable suggestions for improvement.",
    author: "mcp-community",
    version: "1.2.0",
    installCount: 15420,
    rating: 4.8,
    tags: ["code-quality", "security", "review"],
    repositoryUrl: "https://github.com/mcp-community/skill-code-review",
    compatibility: ["claude-code", "cursor", "cline"],
    createdAt: "2025-08-15T10:00:00Z",
    updatedAt: "2025-12-01T14:30:00Z",
  },
  {
    id: "skill-2",
    name: "git-workflow",
    description:
      "Advanced Git workflow automation including branch management, commit message generation, and PR creation assistance.",
    author: "devtools-inc",
    version: "2.0.1",
    installCount: 12350,
    rating: 4.7,
    tags: ["git", "workflow", "automation"],
    repositoryUrl: "https://github.com/devtools-inc/skill-git-workflow",
    compatibility: ["claude-code", "cursor", "windsurf", "cline", "roo-code"],
    createdAt: "2025-06-20T08:00:00Z",
    updatedAt: "2025-11-28T09:15:00Z",
  },
  {
    id: "skill-3",
    name: "test-generator",
    description:
      "Automatically generates unit tests, integration tests, and test fixtures based on your codebase patterns and testing framework.",
    author: "testing-tools",
    version: "1.5.3",
    installCount: 9870,
    rating: 4.6,
    tags: ["testing", "automation", "unit-tests"],
    repositoryUrl: "https://github.com/testing-tools/skill-test-generator",
    compatibility: ["claude-code", "cursor"],
    createdAt: "2025-07-10T12:00:00Z",
    updatedAt: "2025-11-15T16:45:00Z",
  },
  {
    id: "skill-4",
    name: "documentation-writer",
    description:
      "Creates comprehensive documentation including README files, API docs, and inline code comments following best practices.",
    author: "doc-masters",
    version: "1.1.0",
    installCount: 8540,
    rating: 4.5,
    tags: ["documentation", "readme", "api-docs"],
    repositoryUrl: "https://github.com/doc-masters/skill-documentation",
    compatibility: ["claude-code", "windsurf", "cline"],
    createdAt: "2025-09-05T14:00:00Z",
    updatedAt: "2025-10-20T11:30:00Z",
  },
  {
    id: "skill-5",
    name: "refactoring-assistant",
    description:
      "Intelligent code refactoring suggestions with support for design patterns, SOLID principles, and clean code practices.",
    author: "clean-code-labs",
    version: "3.0.0",
    installCount: 7230,
    rating: 4.9,
    tags: ["refactoring", "clean-code", "patterns"],
    repositoryUrl: "https://github.com/clean-code-labs/skill-refactoring",
    compatibility: ["claude-code", "cursor", "cline", "roo-code"],
    createdAt: "2025-05-01T10:00:00Z",
    updatedAt: "2025-12-10T08:00:00Z",
  },
  {
    id: "skill-6",
    name: "database-helper",
    description:
      "SQL query optimization, schema design assistance, and database migration script generation for popular databases.",
    author: "db-tools",
    version: "1.3.2",
    installCount: 6120,
    rating: 4.4,
    tags: ["database", "sql", "optimization"],
    repositoryUrl: "https://github.com/db-tools/skill-database-helper",
    compatibility: ["claude-code", "cursor"],
    createdAt: "2025-08-25T09:00:00Z",
    updatedAt: "2025-11-05T13:20:00Z",
  },
  {
    id: "skill-7",
    name: "api-designer",
    description:
      "Design RESTful and GraphQL APIs with OpenAPI/Swagger specification generation and best practice validation.",
    author: "api-first",
    version: "2.1.0",
    installCount: 5890,
    rating: 4.6,
    tags: ["api", "rest", "graphql", "openapi"],
    repositoryUrl: "https://github.com/api-first/skill-api-designer",
    compatibility: ["claude-code", "windsurf"],
    createdAt: "2025-07-30T11:00:00Z",
    updatedAt: "2025-10-15T10:45:00Z",
  },
  {
    id: "skill-8",
    name: "security-scanner",
    description:
      "Identifies security vulnerabilities, suggests fixes, and ensures code follows OWASP guidelines and security best practices.",
    author: "sec-tools",
    version: "1.0.5",
    installCount: 4560,
    rating: 4.7,
    tags: ["security", "owasp", "vulnerabilities"],
    repositoryUrl: "https://github.com/sec-tools/skill-security-scanner",
    compatibility: ["claude-code", "cursor", "cline"],
    createdAt: "2025-10-01T08:00:00Z",
    updatedAt: "2025-12-05T15:30:00Z",
  },
];
