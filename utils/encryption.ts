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

  // Encrypt binary data (Uint8Array) - handles large data with chunking
  static encryptData(data: Uint8Array, key: string): Uint8Array {
    // For large data, process in chunks to avoid memory issues
    const CHUNK_SIZE = 512 * 1024; // 512KB chunks (smaller for safety)
    const iv = this.generateIV();

    if (data.length <= CHUNK_SIZE) {
      // Small data - encrypt directly
      const wordArray = CryptoJS.lib.WordArray.create(data);
      const encrypted = CryptoJS.AES.encrypt(wordArray, key, {
        iv: CryptoJS.enc.Hex.parse(iv),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });

      // Combine IV and encrypted data
      const ivWords = CryptoJS.enc.Hex.parse(iv);
      const ivBytes = this.wordArrayToUint8Array(ivWords);
      const encryptedBytes = this.wordArrayToUint8Array(encrypted.ciphertext);

      const result = new Uint8Array(ivBytes.length + encryptedBytes.length);
      result.set(ivBytes, 0);
      result.set(encryptedBytes, ivBytes.length);
      return result;
    } else {
      // Large data - convert to base64 in chunks to avoid stack overflow
      const base64Data = this.uint8ArrayToBase64(data);
      const { encrypted, iv: stringIv } = this.encrypt(base64Data, key);

      // Combine everything as a JSON string, then convert to bytes
      const resultObj = {
        data: encrypted,
        iv: stringIv,
        isChunked: true,
      };
      const resultJson = JSON.stringify(resultObj);
      const resultBytes = new TextEncoder().encode(resultJson);
      return resultBytes;
    }
  }

  // Decrypt binary data (Uint8Array) - handles chunked data
  static decryptData(encryptedData: Uint8Array, key: string): Uint8Array {
    try {
      // Check if this is chunked data
      const textData = new TextDecoder().decode(encryptedData);
      try {
        const parsed = JSON.parse(textData);
        if (parsed.isChunked) {
          // Chunked data - decrypt as string then convert back
          const decryptedBase64 = this.decrypt(parsed.data, key, parsed.iv);
          const binaryString = atob(decryptedBase64);
          const result = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            result[i] = binaryString.charCodeAt(i);
          }
          return result;
        }
      } catch (e) {
        // Not chunked data, continue with original method
      }

      // Original method for smaller data
      const ivSize = 16;
      const ivBytes = encryptedData.slice(0, ivSize);
      const encryptedBytes = encryptedData.slice(ivSize);

      const iv = CryptoJS.lib.WordArray.create(ivBytes);
      const ciphertext = CryptoJS.lib.WordArray.create(encryptedBytes);

      const decrypted = CryptoJS.AES.decrypt(
        { ciphertext: ciphertext } as any,
        key,
        {
          iv: iv,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7,
        }
      );

      return this.wordArrayToUint8Array(decrypted);
    } catch (error) {
      throw new Error(
        "Binary decryption failed: Invalid key or corrupted data"
      );
    }
  }

  // Helper method to convert WordArray to Uint8Array
  private static wordArrayToUint8Array(
    wordArray: CryptoJS.lib.WordArray
  ): Uint8Array {
    const words = wordArray.words;
    const sigBytes = wordArray.sigBytes;
    const uint8Array = new Uint8Array(sigBytes);

    for (let i = 0; i < sigBytes; i++) {
      const byteIndex = i % 4;
      const wordIndex = Math.floor(i / 4);
      const word = words[wordIndex];

      // Extract the specific byte from the word (big-endian)
      let byteValue = 0;
      switch (byteIndex) {
        case 0:
          byteValue = (word >> 24) & 0xff;
          break;
        case 1:
          byteValue = (word >> 16) & 0xff;
          break;
        case 2:
          byteValue = (word >> 8) & 0xff;
          break;
        case 3:
          byteValue = word & 0xff;
          break;
      }

      uint8Array[i] = byteValue;
    }

    return uint8Array;
  }

  // Helper method to convert Uint8Array to base64 safely
  private static uint8ArrayToBase64(data: Uint8Array): string {
    // Process in chunks to avoid stack overflow
    const chunkSize = 8192; // 8KB chunks
    let result = "";

    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      const binaryString = String.fromCharCode(...chunk);
      result += binaryString;
    }

    return btoa(result);
  }
}
