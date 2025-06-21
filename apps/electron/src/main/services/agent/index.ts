import { DeployedAgentService } from "./deployed/deployed-agent-service";
import { DevelopmentAgentService } from "./development/development-agent-service";
import { AgentSharingService } from "./shared/agent-sharing-service";

// 開発中エージェント関連
export { DevelopmentAgent } from "./development/development-agent";
export { DevelopmentAgentService } from "./development/development-agent-service";

// デプロイ済みエージェント関連
export { DeployedAgent } from "./deployed/deployed-agent";
export { DeployedAgentService } from "./deployed/deployed-agent-service";

// 共有機能
export { AgentBase, BaseAgentInfo } from "./shared/agent-base";
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

/**
 * 開発中エージェントをデプロイ済みエージェントに変換・作成する
 * @param developmentAgent 開発中エージェント
 * @returns デプロイ済みエージェント
 */
export function deployDevelopmentAgent(developmentAgent: any): any {
  const sharingService = getAgentSharingService();
  const deployedService = getDeployedAgentService();

  const deployedAgentData =
    sharingService.convertDevelopmentToDeployed(developmentAgent);
  return deployedService.deployFromDevelopmentAgent(deployedAgentData);
}

/**
 * 共有URLからデプロイ済みエージェントをインポートする
 * @param shareUrl 共有URL
 * @returns デプロイ済みエージェント
 */
export async function importSharedAgent(shareUrl: string): Promise<any> {
  const sharingService = getAgentSharingService();
  const deployedService = getDeployedAgentService();

  const sharedData = await sharingService.getSharedAgentData(shareUrl);
  const deployedAgentData = sharingService.convertToDeployedAgent(sharedData);
  return deployedService.createDeployedAgent(deployedAgentData);
}

/**
 * 開発中エージェントを共有する
 * @param agent 開発中エージェント
 * @returns 共有リンク
 */
export async function shareAgent(agent: any): Promise<string> {
  const sharingService = getAgentSharingService();
  return await sharingService.shareAgent(agent);
}
