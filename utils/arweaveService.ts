import Bundlr from '@bundlr-network/client';
import Arweave from 'arweave';
import { EncryptionService } from './encryption';

// Bundlr configuration for Polygon (cheapest fees)
const BUNDLR_NODE = 'https://node2.bundlr.network';

// Arweave configuration
const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
  timeout: 20000,
  logging: false,
});

export class ArweaveService {
  private static bundlr: Bundlr | null = null;

  /**
   * Initialize Bundlr with user's wallet
   */
  static async initializeBundlr(signer: any): Promise<void> {
    try {
      console.log(' Initializing Bundlr for Arweave storage...');

      // Use Polygon network for cheapest fees
      this.bundlr = new Bundlr(BUNDLR_NODE, 'matic', signer);

      // Check balance
      const balance = await this.bundlr.getLoadedBalance();
      const balanceMatic = this.bundlr.utils.unitConverter(balance);

      console.log( Bundlr balance:  MATIC);

    } catch (error) {
      console.error(' Failed to initialize Bundlr:', error);
      throw error;
    }
  }

  /**
   * Get upload cost for data
   */
  static async getUploadCost(dataSize: number): Promise<{ costMatic: number; costUsd: number }> {
    if (!this.bundlr) {
      throw new Error('Bundlr not initialized');
    }

    try {
      const cost = await this.bundlr.getPrice(dataSize);
      const costMatic = this.bundlr.utils.unitConverter(cost);
      const costUsd = costMatic.toNumber() * 0.8; // Rough MATIC to USD conversion

      return {
        costMatic: costMatic.toNumber(),
        costUsd: Number(costUsd.toFixed(4))
      };

    } catch (error) {
      console.error('Failed to get upload cost:', error);
      return {
        costMatic: 0.001,
        costUsd: 0.0008
      };
    }
  }

  /**
   * Upload encrypted image data to Arweave
   */
  static async uploadEncryptedImage(
    encryptedData: Uint8Array,
    walletAddress: string,
    imageIndex: number
  ): Promise<string> {
    if (!this.bundlr) {
      throw new Error('Bundlr not initialized');
    }

    try {
      console.log(' Uploading encrypted image to Arweave...');

      // Create transaction with tags
      const tags = [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'App-Name', value: 'FUSE-Social' },
        { name: 'Data-Type', value: 'encrypted-image' },
        { name: 'User-ID', value: walletAddress },
        { name: 'Image-Index', value: imageIndex.toString() },
        { name: 'Timestamp', value: Date.now().toString() },
        { name: 'Version', value: '1.0' }
      ];

      // Prepare data as JSON
      const imageData = {
        encryptedImage: btoa(String.fromCharCode(...encryptedData)),
        timestamp: Date.now(),
        version: '1.0'
      };

      const dataString = JSON.stringify(imageData);

      // Create and sign transaction
      const transaction = this.bundlr.createTransaction(dataString, { tags });
      await transaction.sign();

      // Upload
      const result = await transaction.upload();

      const arweaveUrl = https://arweave.net/;

      console.log( Image uploaded to Arweave: );

      return arweaveUrl;

    } catch (error) {
      console.error(' Failed to upload image to Arweave:', error);
      throw error;
    }
  }

  /**
   * Download and decrypt image from Arweave
   */
  static async downloadEncryptedImage(
    arweaveUrl: string,
    decryptionKey: string
  ): Promise<string> {
    try {
      console.log(' Downloading image from Arweave...');

      // Extract transaction ID from URL
      const transactionId = arweaveUrl.split('/').pop();
      if (!transactionId) {
        throw new Error('Invalid Arweave URL');
      }

      // Fetch data from Arweave
      const response = await fetch(https://arweave.net/);
      if (!response.ok) {
        throw new Error(Failed to fetch from Arweave: );
      }

      const imageData = await response.json();

      // Decrypt the image
      console.log(' Decrypting image data...');
      const encryptedData = Uint8Array.from(atob(imageData.encryptedImage), c => c.charCodeAt(0));
      const decryptedData = EncryptionService.decryptData(encryptedData, decryptionKey);

      // Convert back to base64 for display
      let decryptedBase64 = '';
      const CHUNK_SIZE = 8192;
      for (let i = 0; i < decryptedData.length; i += CHUNK_SIZE) {
        const chunk = decryptedData.slice(i, i + CHUNK_SIZE);
          decryptedBase64 += btoa(String.fromCharCode(...chunk));
      }

      console.log(' Image decrypted successfully');

      return data:image/jpeg;base64,;

    } catch (error) {
      console.error(' Failed to download/decrypt image:', error);
      throw error;
    }
  }
}
