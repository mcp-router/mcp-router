import { safeStorage, app } from 'electron';
import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// 暗号化機能の状態管理
let isEncryptionInitialized = false;
let masterKey: Buffer | null = null;
const MASTER_KEY_SIZE = 32; // 256ビット
const MASTER_KEY_FILENAME = 'encrypted_master_key';
const IV_LENGTH = 16; // AES-GCMの初期化ベクトル長
const AUTH_TAG_LENGTH = 16; // 認証タグ長

// マスターキーファイルのパス
const getMasterKeyFilePath = () => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, MASTER_KEY_FILENAME);
};

/**
 * 暗号化機能の初期化状態を設定
 * @param initialized 初期化状態
 * @returns 初期化が成功したかどうかを示すPromise
 */
export async function setEncryptionInitialized(initialized: boolean): Promise<boolean> {
  isEncryptionInitialized = initialized;
  if (initialized) {
    try {
      await Promise.resolve(initializeMasterKey());
      return true;
    } catch (err) {
      console.error('暗号化初期化エラー:', err);
      // エラーが発生しても初期化状態はtrueのままにする
      return false;
    }
  }
  return true;
}

function initializeMasterKey(): void {
  if (masterKey !== null) return; // 既に確定

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('SafeStorage not available');
  }

  try {
    const keyPath = getMasterKeyFilePath();
    let encryptedMasterKeyBase64: string | null = null;

    if (fs.existsSync(keyPath)) {
      encryptedMasterKeyBase64 = fs.readFileSync(keyPath, 'utf8');
    }

    if (encryptedMasterKeyBase64) {
      // ― 既存キーを復号 ―
      const encryptedMasterKey = Buffer.from(encryptedMasterKeyBase64, 'base64');
      masterKey = Buffer.from(safeStorage.decryptString(encryptedMasterKey), 'hex');
    } else {
      // ― 新規生成 ―
      masterKey = crypto.randomBytes(MASTER_KEY_SIZE);
      const encryptedMasterKey = safeStorage.encryptString(masterKey.toString('hex'));

      const dirPath = path.dirname(keyPath);
      if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });

      fs.writeFileSync(keyPath, encryptedMasterKey.toString('base64'), 'utf8');
    }
  } catch (err) {
    console.error('マスターキー同期初期化エラー:', err);
    // 失敗してもランダムキーで継続
    masterKey = crypto.randomBytes(MASTER_KEY_SIZE);
  }
}

/* ---------- ②  同期版マスターキー取得 ---------- */
function getMasterKey(): Buffer {
  if (!isEncryptionInitialized) {
    throw new Error('暗号化機能が初期化されていません');
  }

  if (masterKey === null) {
    initializeMasterKey();
  }

  if (masterKey === null) {
    throw new Error('マスターキーの初期化に失敗しました');
  }

  return masterKey;
}


export function encryptStringSync(text: string): string {
  if (!text) return text;

  try {
    const key = getMasterKey();

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    const result = Buffer.concat([
      iv,
      authTag,
      Buffer.from(encrypted, 'base64'),
    ]);

    return result.toString('base64');
  } catch (err) {
    console.error('暗号化エラー:', err);
    return text; // 暗号化に失敗した場合は平文を返す
  }
}

/* ---------- ④  decryptStringSync ---------- */
export function decryptStringSync(encryptedText: string): string {
  if (!encryptedText) return encryptedText;

  try {
    const key = getMasterKey();

    const encryptedBuffer = Buffer.from(encryptedText, 'base64');

    const iv       = encryptedBuffer.subarray(0, IV_LENGTH);
    const authTag  = encryptedBuffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const cipherTx = encryptedBuffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(cipherTx, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    console.error('復号エラー:', err);
    return encryptedText; // 復号に失敗した場合は元の暗号化テキストを返す
  }
}

/* ---------- ⑤  encryptObjectSync / decryptObjectSync ---------- */
export function encryptObjectSync<T>(obj: T): string {
  if (obj === undefined || obj === null) return '';
  try {
    return encryptStringSync(JSON.stringify(obj));
  } catch (err) {
    console.error('オブジェクト同期暗号化エラー:', err);
    return JSON.stringify(obj); // 暗号化に失敗した場合はJSON文字列を返す
  }
}

export function decryptObjectSync<T>(encryptedText: string): T | null {
  if (!encryptedText) return null;
  try {
    const json = decryptStringSync(encryptedText);
    return JSON.parse(json) as T;
  } catch (err) {
    console.error('オブジェクト同期復号エラー:', err);
    return JSON.parse(encryptedText); // 復号に失敗した場合は元のJSON文字列を返す
  }
}