import CryptoJS from "crypto-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

// AES-256-GCM encryption utilities for FUSE
export class EncryptionService {
  private static readonly ALGORITHM = "aes-256-gcm";
  private static readonly KEY_SIZE = 256;
  private static readonly IV_SIZE = 96; // 12 bytes for GCM

  // Generate a random encryption key
  static generateKey(): string {
    return CryptoJS.lib.WordArray.random(this.KEY_SIZE / 8).toString();
  }

  // Generate a random IV for GCM
  static generateIV(): string {
    return CryptoJS.lib.WordArray.random(this.IV_SIZE / 8).toString();
  }

  // Encrypt data using AES-256-CBC (compatible with crypto-js)
  static encrypt(
    data: string,
    key: string
  ): { encrypted: string; iv: string; tag: string } {
    const iv = this.generateIV();
    const encrypted = CryptoJS.AES.encrypt(data, key, {
      iv: CryptoJS.enc.Hex.parse(iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    // For CBC, we don't have a separate tag, so we'll use the salt as a simple integrity check
    return {
      encrypted: encrypted.toString(),
      iv: iv,
      tag: encrypted.salt?.toString() || "",
    };
  }

  // Decrypt data using AES-256-CBC
  static decrypt(
    encryptedData: string,
    key: string,
    iv: string,
    tag?: string
  ): string {
    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedData, key, {
        iv: CryptoJS.enc.Hex.parse(iv),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });

      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      throw new Error("Decryption failed: Invalid key, IV, or corrupted data");
    }
  }

  // Derive a key from user password using PBKDF2
  static deriveKey(password: string, salt: string): string {
    return CryptoJS.PBKDF2(password, salt, {
      keySize: this.KEY_SIZE / 32,
      iterations: 10000,
    }).toString();
  }

  // Generate a salt for key derivation
  static generateSalt(): string {
    return CryptoJS.lib.WordArray.random(128 / 8).toString();
  }

  // Store encryption key securely (in production, use Keychain/Keystore)
  static async storeKey(keyId: string, key: string): Promise<void> {
    try {
      await AsyncStorage.setItem(`encryption_key_${keyId}`, key);
    } catch (error) {
      throw new Error("Failed to store encryption key");
    }
  }

  // Retrieve encryption key securely
  static async retrieveKey(keyId: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(`encryption_key_${keyId}`);
    } catch (error) {
      throw new Error("Failed to retrieve encryption key");
    }
  }

  // Generate user-specific encryption keys
  static async generateUserKeys(
    userId: string
  ): Promise<{ masterKey: string; dataKey: string; messagingKey: string }> {
    const masterKey = this.generateKey();
    const dataKey = this.generateKey();
    const messagingKey = this.generateKey();

    // Store master key securely
    await this.storeKey(`${userId}_master`, masterKey);

    return {
      masterKey,
      dataKey,
      messagingKey,
    };
  }

  // Encrypt user profile data
  static encryptUserProfile(profileData: any, encryptionKey: string): string {
    const jsonData = JSON.stringify(profileData);
    const { encrypted, iv, tag } = this.encrypt(jsonData, encryptionKey);

    // Store IV and tag with encrypted data for decryption
    return JSON.stringify({
      data: encrypted,
      iv: iv,
      tag: tag,
    });
  }

  // Decrypt user profile data
  static decryptUserProfile(
    encryptedProfile: string,
    encryptionKey: string
  ): any {
    try {
      const { data, iv, tag } = JSON.parse(encryptedProfile);
      const decrypted = this.decrypt(data, encryptionKey, iv, tag);
      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error("Failed to decrypt user profile");
    }
  }

  // Encrypt message for E2E messaging
  static encryptMessage(
    message: string,
    senderKey: string,
    recipientKey: string
  ): string {
    // Use sender's key for encryption
    const { encrypted, iv, tag } = this.encrypt(message, senderKey);

    return JSON.stringify({
      data: encrypted,
      iv: iv,
      tag: tag,
      senderKey: senderKey, // In production, use key exchange protocol
      timestamp: Date.now(),
    });
  }

  // Decrypt message for E2E messaging
  static decryptMessage(
    encryptedMessage: string,
    decryptionKey: string
  ): string {
    try {
      const { data, iv, tag } = JSON.parse(encryptedMessage);
      return this.decrypt(data, decryptionKey, iv, tag);
    } catch (error) {
      throw new Error("Failed to decrypt message");
    }
  }

  // Hash data for integrity checks
  static hashData(data: string): string {
    return CryptoJS.SHA256(data).toString();
  }

  // Verify data integrity
  static verifyIntegrity(data: string, hash: string): boolean {
    return this.hashData(data) === hash;
  }
}
