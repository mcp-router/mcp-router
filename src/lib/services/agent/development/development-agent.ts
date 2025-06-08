import { AgentConfig, MCPServerConfig, MCPTool, MCPAgentToolPermission } from '../../../../types';
import { AgentBase, BaseAgentInfo } from '../shared/agent-base';
import { logError, logInfo } from '../../../utils/error-handler';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { connectToMCPServer, fetchServerTools, fetchServerResources, readServerResource } from '../../../utils/mcp-client-util';

/**
 * サーバー情報を表す型
 */
type ServerInfo = {
  config: MCPServerConfig;
  client?: Client;
  status: 'running' | 'starting' | 'stopping' | 'stopped' | 'error';
};

/**
 * 開発中エージェントクラス
 * 開発時に必要な機能（MCPサーバー管理、リアルタイムデバッグ、ツール権限管理等）を提供
 */
export class DevelopmentAgent extends AgentBase {
  private serverInfoMap: Map<string, ServerInfo> = new Map();

  /**
   * コンストラクタ
   * @param config エージェント設定
   */
  constructor(config: AgentConfig) {
    // createdAt と updatedAt のデフォルト値を設定
    const now = Date.now();
    const normalizedConfig: BaseAgentInfo = {
      ...config,
      createdAt: config.createdAt || now,
      updatedAt: config.updatedAt || now
    };
    
    super(normalizedConfig);
    
    // サーバー情報の初期化
    if (this.config.mcpServers && this.config.mcpServers.length > 0) {
      for (const server of this.config.mcpServers) {
        this.serverInfoMap.set(server.id, {
          config: server,
          status: 'stopped'
        });
      }
    }
  }

  /**
   * エージェントの完全な設定を取得する
   */
  public getConfig(): AgentConfig {
    return this.config as AgentConfig;
  }

  /**
   * エージェントの非同期初期化
   * @param syncToolPermissions ツール権限を同期するかどうか
   */
  public async init(syncToolPermissions = true): Promise<void> {
    if (syncToolPermissions) {
      await this.synchronizeToolPermissions();
    }
  }

  /**
   * エージェントの設定を更新する
   * @param newConfig 新しい設定（部分的）
   * @param syncToolPermissions ツール権限を同期するかどうか
   */
  public async updateConfig(newConfig: Partial<AgentConfig>, syncToolPermissions = true): Promise<AgentConfig> {
    // MCPサーバーの構成に変更があるかチェック
    let serversChanged = false;
    
    if (newConfig.mcpServers !== undefined) {
      serversChanged = this.hasServerConfigChanged(
        this.config.mcpServers || [],
        newConfig.mcpServers
      );
    }

    // 設定を更新
    this.config = {
      ...this.config,
      ...newConfig,
      updatedAt: Date.now(),
      createdAt: this.config.createdAt
    };

    // サーバー情報が変更された場合、サーバーマップを再初期化
    if (serversChanged) {
      this.serverInfoMap.clear();
      this.initializeServers();
    }

    // MCP サーバー構成が変更された場合、またはリクエストされた場合にツール権限を同期
    if ((serversChanged || syncToolPermissions) && this.config.mcpServers) {
      logInfo(`エージェント ${this.getLogIdentifier()} のMCPサーバー構成変更検出: ${serversChanged ? '変更あり' : '変更なし'}`);
      await this.synchronizeToolPermissions();
    }

    return this.config as AgentConfig;
  }

  /**
   * サーバー情報を初期化する
   */
  private initializeServers(): void {
    if (this.config.mcpServers && this.config.mcpServers.length > 0) {
      for (const server of this.config.mcpServers) {
        this.serverInfoMap.set(server.id, {
          config: server,
          status: 'stopped'
        });
      }
    }
  }



  /**
   * エージェント用のMCPサーバを開始する
   */
  public async startServers(): Promise<boolean> {
    try {
      let allSuccess = true;
      
      for (const server of this.config.mcpServers) {
        const success = await this.startServer(server.id);
        if (!success) {
          allSuccess = false;
        }
      }
      
      logInfo(`エージェント ${this.getLogIdentifier()} のMCPサーバを開始しました`);
      return allSuccess;
    } catch (error) {
      logError(`エージェント ${this.getLogIdentifier()} のMCPサーバ起動中にエラーが発生しました`, error);
      return false;
    }
  }

  /**
   * 特定のエージェント用MCPサーバを開始する
   */
  public async startServer(serverId: string, maxRetries = 3): Promise<boolean> {
    const server = this.findServerConfig(serverId);
    if (!server) {
      logError(`サーバが見つかりません (ID: ${serverId})`);
      return false;
    }

    const status = this.serverInfoMap.get(serverId)?.status;
    if (status === 'running' || status === 'starting') {
      return true;
    }

    return await this.connectToServerWithRetry(serverId, maxRetries);
  }

  /**
   * サーバー接続を再試行ロジックで行う
   */
  private async connectToServerWithRetry(serverId: string, maxRetries: number): Promise<boolean> {
    const server = this.findServerConfig(serverId);
    if (!server) {
      return false;
    }

    this.serverInfoMap.get(serverId)!.status = 'starting';

    let retryCount = 0;
    while (retryCount < maxRetries) {
      try {
        const client = await this.connectToServer(serverId);
        if (client) {
          this.serverInfoMap.get(serverId)!.client = client;
          this.serverInfoMap.get(serverId)!.status = 'running';
          return true;
        }

        retryCount++;
        if (retryCount >= maxRetries) {
          this.serverInfoMap.get(serverId)!.status = 'error';
          logError(`サーバ "${server.name}" (ID: ${serverId}) への接続が最大試行回数を超えました`);
          return false;
        }

        logInfo(`サーバ "${server.name}" (ID: ${serverId}) への接続を再試行します (${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
      } catch (error) {
        retryCount++;
        logError(`サーバ "${server.name}" (ID: ${serverId}) への接続中にエラーが発生しました (試行 ${retryCount}/${maxRetries})`, error);

        if (retryCount >= maxRetries) {
          this.serverInfoMap.get(serverId)!.status = 'error';
          return false;
        }

        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
      }
    }

    this.serverInfoMap.get(serverId)!.status = 'error';
    return false;
  }

  /**
   * サーバーに接続する
   */
  private async connectToServer(serverId: string): Promise<Client | null> {
    const server = this.findServerConfig(serverId);
    if (!server) {
      return null;
    }

    try {
      const client = await connectToMCPServer(
        {
          id: server.id,
          name: server.name,
          serverType: server.serverType,
          command: server.command,
          args: server.args,
          remoteUrl: server.remoteUrl,
          bearerToken: server.bearerToken,
          env: server.env,
          inputParams: server.inputParams
        },
        `mcp-router-agent`
      );

      if (!client) {
        this.serverInfoMap.get(serverId)!.status = 'error';
      }

      return client;
    } catch (error) {
      this.serverInfoMap.get(serverId)!.status = 'error';
      return null;
    }
  }

  /**
   * エージェント用のMCPサーバを停止する
   */
  public stopServers(): boolean {
    try {
      let allSuccess = true;

      for (const server of this.config.mcpServers) {
        const success = this.stopServer(server.id);
        if (!success) {
          allSuccess = false;
        }
      }

      logInfo(`エージェント ${this.getLogIdentifier()} のMCPサーバを停止しました`);
      return allSuccess;
    } catch (error) {
      logError(`エージェント ${this.getLogIdentifier()} のMCPサーバ停止中にエラーが発生しました`, error);
      return false;
    }
  }

  /**
   * 特定のエージェント用MCPサーバを停止する
   */
  public stopServer(serverId: string): boolean {
    const server = this.findServerConfig(serverId);
    if (!server) {
      return false;
    }

    const client = this.serverInfoMap.get(serverId)?.client;
    if (!client) {
      this.serverInfoMap.get(serverId)!.status = 'stopped';
      return true;
    }

    try {
      this.serverInfoMap.get(serverId)!.status = 'stopping';

      client.close();
      this.serverInfoMap.get(serverId)!.client = undefined;
      this.serverInfoMap.get(serverId)!.status = 'stopped';

      logInfo(`サーバ "${server.name}" を停止しました (ID: ${serverId})`);
      return true;
    } catch (error) {
      logError(`サーバ "${server.name}" (ID: ${serverId}) の停止中にエラーが発生しました`, error);
      this.serverInfoMap.get(serverId)!.status = 'error';
      return false;
    }
  }

  /**
   * サーバーIDのクライアントを取得する
   */
  public getClient(serverId: string): Client | undefined {
    return this.serverInfoMap.get(serverId)?.client;
  }

  /**
   * サーバーからツール情報を取得する
   */
  public async fetchServerTools(serverId: string): Promise<MCPTool[]> {
    const client = this.serverInfoMap.get(serverId)?.client;
    if (!client) {
      return [];
    }

    try {
      const tools = await fetchServerTools(client);

      return tools.map(tool => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.parameters || tool.inputSchema || undefined
      }));
    } catch (error) {
      logError(`サーバー (${serverId}) からのツール取得中にエラーが発生しました`, error);
      return [];
    }
  }

  /**
   * サーバーからリソース一覧を取得する
   */
  public async getServerResources(serverId: string): Promise<any[]> {
    const client = this.serverInfoMap.get(serverId)?.client;
    if (!client) {
      return [];
    }
    try {
      return await fetchServerResources(client);
    } catch (error) {
      logError(`サーバー (ID: ${serverId}) からのリソース取得中にエラーが発生しました`, error);
      return [];
    }
  }

  /**
   * サーバーからリソースを読み込む
   */
  public async readServerResource(serverId: string, uri: string): Promise<any> {
    const client = this.serverInfoMap.get(serverId)?.client;
    if (!client) {
      throw new Error(`サーバー (ID: ${serverId}) に接続できていません`);
    }

    try {
      return await readServerResource(client, uri);
    } catch (error) {
      logError(`サーバー (ID: ${serverId}) からのリソース読み込み中にエラーが発生しました`, error);
      throw error;
    }
  }

  /**
   * エージェントのMCPサーバから利用可能なツールを取得する（抽象メソッドの実装）
   */
  public async getServerTools(): Promise<Record<string, (MCPTool & { enabled?: boolean })[]>> {
    try {
      await this.synchronizeToolPermissions();

      const result: Record<string, (MCPTool & { enabled?: boolean })[]> = {};
      const permissionsToUpdate: Record<string, MCPAgentToolPermission[]> = {};

      for (const server of this.config.mcpServers) {
        try {
          logInfo(`サーバ "${server.name}" (ID: ${server.id}) からツールを取得中...`);

          let tools: MCPTool[] = [];

          const status = this.serverInfoMap.get(server.id)?.status;
          if (status !== 'running') {
            logInfo(`サーバ "${server.name}" (ID: ${server.id}) を起動中！`);
            await this.startServer(server.id);
          }
          tools = await this.fetchServerTools(server.id);

          if (tools && tools.length > 0) {
            let currentPermissions: Record<string, MCPAgentToolPermission[]> = {};

            if (this.config.toolPermissions) {
              currentPermissions = this.config.toolPermissions;
            }

            const serverPermissions = currentPermissions[server.id] || [];
            const updatedServerPermissions: MCPAgentToolPermission[] = [];

            const toolsWithPermissions = tools.map((tool: MCPTool) => {
              const existingPermission = serverPermissions.find(p => p.toolName === tool.name);

              const toolPermission: MCPAgentToolPermission = {
                toolName: tool.name,
                inputSchema: tool.inputSchema,
                description: tool.description || existingPermission?.description || tool.name || '',
                enabled: existingPermission ? existingPermission.enabled : true
              };

              updatedServerPermissions.push(toolPermission);

              const toolWithPermission: MCPTool & { enabled?: boolean } = {
                ...tool,
                enabled: toolPermission.enabled
              };

              return toolWithPermission;
            });

            permissionsToUpdate[server.id] = updatedServerPermissions;
            result[server.id] = toolsWithPermissions;
          }
        } catch (error) {
          logError(`サーバ "${server.name}" (ID: ${server.id}) からのツール取得中にエラーが発生しました`, error);
        }
      }

      if (Object.keys(permissionsToUpdate).length > 0) {
        await this.updateToolPermissions(permissionsToUpdate);
      }

      logInfo(`エージェント ${this.getLogIdentifier()} のサーバツールを取得しました`);
      return result;
    } catch (error) {
      logError(`エージェント (ID: ${this.id}) のサーバツール取得中にエラーが発生しました`, error);
      return {};
    }
  }

  /**
   * mcpServersとtoolPermissionsのデータ整合性を確保する
   */
  public async synchronizeToolPermissions(): Promise<boolean> {
    try {
      logInfo(`エージェント ${this.getLogIdentifier()} のツール権限を同期中...`);

      let updatedToolPermissions: Record<string, MCPAgentToolPermission[]> = {};

      if (this.config.toolPermissions) {
        updatedToolPermissions = JSON.parse(JSON.stringify(this.config.toolPermissions));
      }

      const existingServerIds = new Set(this.config.mcpServers.map(server => server.id));

      for (const serverId of Object.keys(updatedToolPermissions)) {
        if (!existingServerIds.has(serverId)) {
          delete updatedToolPermissions[serverId];
          logInfo(`サーバー (ID: ${serverId}) が存在しないため、ツール権限を削除しました`);
        }
      }

      for (const server of this.config.mcpServers) {
        const serverId = server.id;

        logInfo(`サーバー (ID: ${serverId}) を起動してツール情報を取得します`);
        const success = await this.startServer(serverId);
        if (!success) {
          logError(`サーバー (ID: ${serverId}) を起動できなかったため、ツール情報を更新できません`);
          continue;
        }

        try {
          const tools = await this.fetchServerTools(serverId);

          if (tools && tools.length > 0) {
            const currentServerPermissions = updatedToolPermissions[serverId] || [];

            const updatedServerPermissions = tools.map(tool => {
              const existingPermission = currentServerPermissions.find(p => p.toolName === tool.name);

              return {
                toolName: tool.name,
                inputSchema: tool.inputSchema,
                description: tool.description || existingPermission?.description || tool.name || '',
                enabled: existingPermission ? existingPermission.enabled : true
              };
            });

            updatedToolPermissions[serverId] = updatedServerPermissions;
            logInfo(`サーバー (ID: ${serverId}) のツール権限を更新しました (${updatedServerPermissions.length} ツール)`);
          }
        } catch (error) {
          logError(`サーバー (ID: ${serverId}) からのツール取得中にエラーが発生しました`, error);
        }
      }

      this.config.toolPermissions = updatedToolPermissions;
      logInfo(`エージェント ${this.getLogIdentifier()} のツール権限同期が完了しました`);
      return true;
    } catch (error) {
      logError(`エージェント (ID: ${this.id}) のツール権限同期中にエラーが発生しました`, error);
      return false;
    }
  }

  /**
   * エージェントのツール権限を更新する
   */
  public async updateToolPermissions(permissions: Record<string, MCPAgentToolPermission[]>): Promise<void> {
    try {
      let updatedToolPermissions: Record<string, MCPAgentToolPermission[]> = {};

      if (this.config.toolPermissions) {
        updatedToolPermissions = JSON.parse(JSON.stringify(this.config.toolPermissions));
      }

      const existingServerIds = new Set(this.config.mcpServers.map(server => server.id));

      for (const serverId of Object.keys(updatedToolPermissions)) {
        if (!existingServerIds.has(serverId)) {
          delete updatedToolPermissions[serverId];
          logInfo(`サーバー (ID: ${serverId}) が存在しないため、ツール権限を削除しました`);
        }
      }

      for (const [serverId, serverPermissions] of Object.entries(permissions)) {
        if (existingServerIds.has(serverId)) {
          const currentServerPermissions = updatedToolPermissions[serverId] || [];

          const newServerPermissions = serverPermissions.map(permission => {
            const existingPermission = currentServerPermissions.find(p => p.toolName === permission.toolName);

            return {
              toolName: permission.toolName,
              inputSchema: permission.inputSchema || existingPermission?.inputSchema,
              description: permission.description || existingPermission?.description || permission.toolName || '',
              enabled: permission.enabled !== undefined ? permission.enabled :
                       existingPermission?.enabled !== undefined ? existingPermission.enabled : true
            };
          });

          updatedToolPermissions[serverId] = newServerPermissions;
          logInfo(`サーバー (ID: ${serverId}) のツール権限を更新しました`);
        } else {
          logInfo(`サーバー (ID: ${serverId}) は存在しないため、権限は追加されません`);
        }
      }

      this.config.toolPermissions = updatedToolPermissions;

      logInfo(`エージェント ${this.getLogIdentifier()} のツール権限が更新されました`);
    } catch (error) {
      logError(`ID: ${this.id} のエージェントのツール権限更新中にエラーが発生しました`, error);
    }
  }

  /**
   * ツール名からそのツールを提供できるサーバーを検索する
   */
  public async findServerForTool(toolName: string): Promise<string | undefined> {
    if (!this.config.mcpServers || this.config.mcpServers.length === 0) {
      return undefined;
    }

    for (const server of this.config.mcpServers) {
      const success = await this.startServer(server.id);
      if (!success) continue;

      const tools = await this.fetchServerTools(server.id);

      if (tools.some(tool => tool.name === toolName)) {
        return server.id;
      }
    }

    return undefined;
  }

  /**
   * MCPツールを呼び出す
   */
  public async callTool(toolName: string, args: Record<string, any>): Promise<any> {
    try {
      const serverId = await this.findServerForTool(toolName);
      if (!serverId) {
        throw new Error(`ツール "${toolName}" を提供できるサーバーが見つかりません`);
      }

      const isEnabled = this.getToolPermission(serverId, toolName);
      if (!isEnabled) {
        throw new Error(`ツール "${toolName}" はこのエージェントでは許可されていません`);
      }

      const success = await this.startServer(serverId);
      if (!success) {
        throw new Error(`サーバー (ID: ${serverId}) を開始できませんでした`);
      }

      const client = this.serverInfoMap.get(serverId)?.client;
      if (!client) {
        throw new Error(`サーバー (ID: ${serverId}) に接続できませんでした`);
      }

      const result = await client.callTool({
        name: toolName,
        arguments: args
      });

      logInfo(`エージェント ${this.getLogIdentifier()} がツール "${toolName}" を呼び出しました`);
      return result;
    } catch (error) {
      logError(`ツールの呼び出し中にエラーが発生しました`, error);
      throw error;
    }
  }
}
