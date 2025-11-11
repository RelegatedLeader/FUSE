import AsyncStorage from "@react-native-async-storage/async-storage";
import { EncryptionService } from "./encryption";

// Secure key management for FUSE
export class KeyManager {
  private static readonly MASTER_KEY_ID = "fuse_master_key";
  private static readonly DEVICE_KEY_ID = "fuse_device_key";
  private static readonly BACKUP_KEY_ID = "fuse_backup_key";

  // Initialize device encryption keys
  static async initializeDeviceKeys(): Promise<{
    masterKey: string;
    deviceKey: string;
  }> {
    try {
      // Check if keys already exist
      let masterKey = await this.getStoredKey(this.MASTER_KEY_ID);
      let deviceKey = await this.getStoredKey(this.DEVICE_KEY_ID);

      if (!masterKey || !deviceKey) {
        // Generate new keys
        masterKey = EncryptionService.generateKey();
        deviceKey = EncryptionService.generateKey();

        // Store keys securely
        await this.storeKeySecurely(this.MASTER_KEY_ID, masterKey);
        await this.storeKeySecurely(this.DEVICE_KEY_ID, deviceKey);

        console.log("🔐 Generated and stored new device encryption keys");
      }

      return { masterKey, deviceKey };
    } catch (error) {
      throw new Error("Failed to initialize device keys: " + error);
    }
  }

  // Generate user-specific keys for a wallet address
  static async generateUserKeys(walletAddress: string): Promise<{
    masterKey: string;
    dataKey: string;
    messagingKey: string;
    backupKey: string;
  }> {
    try {
      const userKeyId = `user_${walletAddress}`;

      // Check if user keys already exist
      const existingKeys = await this.getUserKeys(walletAddress);
      if (existingKeys) {
        return existingKeys;
      }

      // Generate new keys
      const masterKey = EncryptionService.generateKey();
      const dataKey = EncryptionService.generateKey();
      const messagingKey = EncryptionService.generateKey();
      const backupKey = EncryptionService.generateKey();

      // Encrypt keys with device master key for secure storage
      const deviceKeys = await this.initializeDeviceKeys();
      const encryptedKeys = {
        masterKey: EncryptionService.encrypt(masterKey, deviceKeys.masterKey),
        dataKey: EncryptionService.encrypt(dataKey, deviceKeys.masterKey),
        messagingKey: EncryptionService.encrypt(
          messagingKey,
          deviceKeys.masterKey
        ),
        backupKey: EncryptionService.encrypt(backupKey, deviceKeys.masterKey),
      };

      // Store encrypted keys
      await AsyncStorage.setItem(
        `${userKeyId}_keys`,
        JSON.stringify(encryptedKeys)
      );

      console.log(
        "🔑 Generated and stored user encryption keys for:",
        walletAddress
      );

      return {
        masterKey,
        dataKey,
        messagingKey,
        backupKey,
      };
    } catch (error) {
      throw new Error("Failed to generate user keys: " + error);
    }
  }

  // Retrieve user keys for a wallet address
  static async getUserKeys(walletAddress: string): Promise<{
    masterKey: string;
    dataKey: string;
    messagingKey: string;
    backupKey: string;
  } | null> {
    try {
      const userKeyId = `user_${walletAddress}`;
      const storedKeys = await AsyncStorage.getItem(`${userKeyId}_keys`);

      if (!storedKeys) {
        return null;
      }

      const deviceKeys = await this.initializeDeviceKeys();
      const encryptedKeys = JSON.parse(storedKeys);

      // Decrypt keys using device master key
      return {
        masterKey: EncryptionService.decrypt(
          encryptedKeys.masterKey.encrypted,
          deviceKeys.masterKey,
          encryptedKeys.masterKey.iv,
          encryptedKeys.masterKey.tag
        ),
        dataKey: EncryptionService.decrypt(
          encryptedKeys.dataKey.encrypted,
          deviceKeys.masterKey,
          encryptedKeys.dataKey.iv,
          encryptedKeys.dataKey.tag
        ),
        messagingKey: EncryptionService.decrypt(
          encryptedKeys.messagingKey.encrypted,
          deviceKeys.masterKey,
          encryptedKeys.messagingKey.iv,
          encryptedKeys.messagingKey.tag
        ),
        backupKey: EncryptionService.decrypt(
          encryptedKeys.backupKey.encrypted,
          deviceKeys.masterKey,
          encryptedKeys.backupKey.iv,
          encryptedKeys.backupKey.tag
        ),
      };
    } catch (error) {
      console.error("Failed to retrieve user keys:", error);
      return null;
    }
  }

  // Create backup of user keys (encrypted with backup key)
  static async createKeyBackup(walletAddress: string): Promise<string> {
    try {
      const userKeys = await this.getUserKeys(walletAddress);
      if (!userKeys) {
        throw new Error("User keys not found");
      }

      const backupData = {
        walletAddress,
        keys: userKeys,
        timestamp: Date.now(),
        version: "1.0",
      };

      const backupKey =
        (await this.getStoredKey(this.BACKUP_KEY_ID)) ||
        EncryptionService.generateKey();

      if (!(await this.getStoredKey(this.BACKUP_KEY_ID))) {
        await this.storeKeySecurely(this.BACKUP_KEY_ID, backupKey);
      }

      const encryptedBackup = EncryptionService.encrypt(
        JSON.stringify(backupData),
        backupKey
      );

      return JSON.stringify(encryptedBackup);
    } catch (error) {
      throw new Error("Failed to create key backup: " + error);
    }
  }

  // Restore keys from backup
  static async restoreFromBackup(encryptedBackup: string): Promise<boolean> {
    try {
      const backupKey = await this.getStoredKey(this.BACKUP_KEY_ID);
      if (!backupKey) {
        throw new Error("Backup key not found");
      }

      const encryptedData = JSON.parse(encryptedBackup);
      const decryptedData = EncryptionService.decrypt(
        encryptedData.encrypted,
        backupKey,
        encryptedData.iv,
        encryptedData.tag
      );

      const backupData = JSON.parse(decryptedData);

      // Restore keys to storage
      await this.generateUserKeys(backupData.walletAddress);

      console.log("🔄 Successfully restored keys from backup");
      return true;
    } catch (error) {
      console.error("Failed to restore from backup:", error);
      return false;
    }
  }

  // Rotate user keys (for security)
  static async rotateUserKeys(walletAddress: string): Promise<void> {
    try {
      // Generate new keys
      const newKeys = await this.generateUserKeys(walletAddress);

      // Create backup of old keys before rotation
      const oldKeys = await this.getUserKeys(walletAddress);
      if (oldKeys) {
        const backup = await this.createKeyBackup(walletAddress);
        await AsyncStorage.setItem(
          `backup_${walletAddress}_${Date.now()}`,
          backup
        );
      }

      console.log(
        "🔄 Successfully rotated encryption keys for:",
        walletAddress
      );
    } catch (error) {
      throw new Error("Failed to rotate user keys: " + error);
    }
  }

  // Secure key storage using AsyncStorage with additional encryption
  private static async storeKeySecurely(
    keyId: string,
    key: string
  ): Promise<void> {
    try {
      // Additional layer: encrypt the key with device-specific salt
      const salt = await this.getOrCreateSalt();
      const hashedKeyId = EncryptionService.hashData(keyId + salt);
      const encryptedKey = EncryptionService.encrypt(key, hashedKeyId);

      await AsyncStorage.setItem(
        `secure_key_${keyId}`,
        JSON.stringify(encryptedKey)
      );
    } catch (error) {
      throw new Error("Failed to store key securely: " + error);
    }
  }

  // Retrieve securely stored key
  private static async getStoredKey(keyId: string): Promise<string | null> {
    try {
      const stored = await AsyncStorage.getItem(`secure_key_${keyId}`);
      if (!stored) return null;

      const salt = await this.getOrCreateSalt();
      const hashedKeyId = EncryptionService.hashData(keyId + salt);
      const encryptedKey = JSON.parse(stored);

      return EncryptionService.decrypt(
        encryptedKey.encrypted,
        hashedKeyId,
        encryptedKey.iv,
        encryptedKey.tag
      );
    } catch (error) {
      return null;
    }
  }

  // Get or create device-specific salt
  private static async getOrCreateSalt(): Promise<string> {
    try {
      let salt = await AsyncStorage.getItem("device_salt");
      if (!salt) {
        salt = EncryptionService.generateSalt();
        await AsyncStorage.setItem("device_salt", salt);
      }
      return salt;
    } catch (error) {
      throw new Error("Failed to get device salt: " + error);
    }
  }

  // Clear all keys (for logout/reset)
  static async clearAllKeys(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const keyPatterns = [
        "secure_key_",
        "encryption_key_",
        "user_.*_keys",
        "backup_.*",
        "device_salt",
      ];

      const keysToRemove = keys.filter((key) =>
        keyPatterns.some((pattern) => key.includes(pattern))
      );

      await AsyncStorage.multiRemove(keysToRemove);
      console.log("🗑️ Cleared all encryption keys");
    } catch (error) {
      throw new Error("Failed to clear keys: " + error);
    }
  }
}
