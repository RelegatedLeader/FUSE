// import Bundlr from "@bundlr-network/client";
import Arweave from "arweave";
import { EncryptionService } from "./encryption";

// Bundlr configuration for Polygon (cheapest fees)
// const BUNDLR_NODE = "https://node2.bundlr.network";

// Arweave configuration
const arweave = Arweave.init({
  host: "arweave.net",
  port: 443,
  protocol: "https",
  timeout: 20000,
  logging: false,
});

export class ArweaveService {
  // private static bundlr: Bundlr | null = null;

  /**
   * Initialize Bundlr with user's wallet
   */
  // static async initializeBundlr(signer: any): Promise<void> {
  //   try {
  //     console.log("🔶 Initializing Bundlr for Arweave storage...");

  //     // Use Polygon network for cheapest fees
  //     this.bundlr = new Bundlr(BUNDLR_NODE, "matic", signer);

  //     // Check balance
  //     const balance = await this.bundlr.getLoadedBalance();
  //     const balanceMatic = this.bundlr.utils.unitConverter(balance);

  //     console.log(`Bundlr balance: ${balanceMatic} MATIC`);
  //     } catch (error) {
  //       console.error("❌ Failed to initialize Bundlr:", error);
  //       throw error;
  //     }
  //   }
  // }

  /**
   * Get upload cost for data
   */
  static async getUploadCost(
    dataSize: number
  ): Promise<{ costMatic: number; costUsd: number }> {
    throw new Error("Bundlr not implemented yet");
  }

  /**
   * Upload encrypted image data to Arweave
   */
  static async uploadEncryptedImage(
    encryptedData: Uint8Array,
    walletAddress: string,
    imageIndex: number
  ): Promise<string> {
    throw new Error("Bundlr not implemented yet");
  }

  /**
   * Download and decrypt image from Arweave
   */
  static async downloadEncryptedImage(
    arweaveUrl: string,
    decryptionKey: string
  ): Promise<string> {
    try {
      console.log(" Downloading image from Arweave...");

      // Extract transaction ID from URL
      const transactionId = arweaveUrl.split("/").pop();
      if (!transactionId) {
        throw new Error("Invalid Arweave URL");
      }

      // Fetch data from Arweave
      const response = await fetch(`https://arweave.net/${transactionId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch from Arweave: ${response.statusText}`);
      }

      const imageData = await response.json();

      // Decrypt the image
      console.log(" Decrypting image data...");
      const encryptedData = Uint8Array.from(
        atob(imageData.encryptedImage),
        (c) => c.charCodeAt(0)
      );
      const decryptedData = EncryptionService.decryptData(
        encryptedData,
        decryptionKey
      );

      // Convert back to base64 for display
      let decryptedBase64 = "";
      const CHUNK_SIZE = 8192;
      for (let i = 0; i < decryptedData.length; i += CHUNK_SIZE) {
        const chunk = decryptedData.slice(i, i + CHUNK_SIZE);
        decryptedBase64 += btoa(String.fromCharCode(...chunk));
      }

      console.log(" Image decrypted successfully");

      return `data:image/jpeg;base64,${decryptedBase64}`;
    } catch (error) {
      console.error(" Failed to download/decrypt image:", error);
      throw error;
    }
  }
}
