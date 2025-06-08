import { machineIdSync } from 'node-machine-id';
import { AppSettings } from '../lib/types/settings-types';
import { getSettingsService } from '../lib/services/settings-service';
import { API_BASE_URL } from '../main';
import { fetchWithTokenJson } from '../lib/utils/fetch-utils';

// Get the settings service
const settingsService = getSettingsService();

// Check if app is activated
export function isAppActivated(): boolean {
  try {
    // return true;
    const settings = settingsService.getSettings();
    return !!settings.invitationCode;
  } catch (error) {
    console.error('Error checking activation status:', error);
    return false;
  }
}

// Validate client ID with the API
export async function validateClientId(): Promise<boolean> {
  try {
    // Get machine ID
    const machineId = machineIdSync();
    
    // Check if client ID is valid by sending a GET request to the API
    const response = await fetch(`${API_BASE_URL}/app-invitations/check?machineId=${machineId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      return true;
    } else {
      console.error('Client ID validation failed:', data.message || 'Unknown error');
      return false;
    }
  } catch (error) {
    console.error('Error validating client ID:', error);
    return false;
  }
}

// Save invitation info
export async function saveInvitationInfo(invitationCode: string): Promise<boolean> {
  try {
    // If invitation code is empty, skip validation and allow invitation
    if (!invitationCode.trim()) {
      const currentSettings = settingsService.getSettings();
      const updatedSettings: AppSettings = {
        ...currentSettings,
        invitationCode: 'mock-invitation-code', // Use a mock code for testing
        invitedAt: new Date().toISOString(),
      };
      settingsService.saveSettings(updatedSettings);
      return true;
    }

    // Get machine ID
    const machineId = machineIdSync();
    
    // Validate the activation code by sending a POST request to the API
    const response = await fetch(`${API_BASE_URL}/app-invitations/use`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ machineId, code: invitationCode })
    });
    
    const data = await response.json();
    
    // Only save if the API confirms the code is valid
    if (data.success) {
      // 現在の設定を取得
      const currentSettings = settingsService.getSettings();
      
      // 招待情報を更新
      const updatedSettings: AppSettings = {
        ...currentSettings,
        invitationCode,
        invitedAt: new Date().toISOString(),
      };
      
      // 設定を保存
      settingsService.saveSettings(updatedSettings);
      return true;
    } else {
      console.error('Invalid invitation code:', data.message || 'Unknown error');
      return false;
    }
  } catch (error) {
    console.error('Error validating/saving invitation info:', error);
    return false;
  }
}

// Helper function to generate a new invitation
export async function generateNewInvitation(machineId: string) {
  return fetchWithTokenJson('/app-invitations', {
    method: 'POST',
    body: JSON.stringify({ machineId })
  });
}

