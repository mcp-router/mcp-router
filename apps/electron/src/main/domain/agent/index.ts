import { DeployedAgentService } from "./deployed/deployed-agent-service";
import { DevelopmentAgentService } from "./development/development-agent-service";
import { AgentSharingService } from "./shared/agent-sharing-service";

// 開発中エージェント関連
export { DevelopmentAgentService } from "./development/development-agent-service";

// デプロイ済みエージェント関連
export { DeployedAgentService } from "./deployed/deployed-agent-service";

// 共有機能
export { AgentSharingService } from "./shared/agent-sharing-service";

// 便利な統一エクスポート関数

/**
 * 開発中エージェントサービスのシングルトンインスタンスを取得
 */
export function getDevelopmentAgentService() {
  return DevelopmentAgentService.getInstance();
}

/**
 * デプロイ済みエージェントサービスのシングルトンインスタンスを取得
 */
export function getDeployedAgentService() {
  return DeployedAgentService.getInstance();
}

/**
 * エージェント共有サービスのシングルトンインスタンスを取得
 */
export function getAgentSharingService() {
  return AgentSharingService.getInstance();
}
