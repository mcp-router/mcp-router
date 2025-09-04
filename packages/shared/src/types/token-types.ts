/**
 * トークン関連の型定義
 */

/**
 * トークンのインターフェース
 */
export interface Token {
  id: string; // トークンの一意のID
  clientId: string; // 関連付けられたクライアントID
  issuedAt: number; // トークン発行時のUNIXタイムスタンプ
  serverIds: string[]; // アクセスを許可するサーバIDのリスト
}

/**
 * トークン生成時のオプション
 */
export interface TokenGenerateOptions {
  clientId: string; // クライアントID
  serverIds: string[]; // アクセスを許可するサーバIDのリスト
  expiresIn?: number; // トークンの有効期間（秒）、デフォルトは24時間
}

/**
 * トークン検証の結果
 */
export interface TokenValidationResult {
  isValid: boolean; // トークンが存在するかどうか
  clientId?: string; // 有効な場合のクライアントID
  error?: string; // エラーメッセージ（存在しない場合）
}
