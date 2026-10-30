import { Uploader } from "@irys/upload";
import { Solana } from "@irys/upload-solana";
import bs58 from "bs58";
import fs from "fs";
import wallet from "../../devnet-wallet.json";

// ── config ──────────────────────────────────────────────
const RPC = "https://api.devnet.solana.com";
const IMAGE_PATH = "./assets/image.jpeg"; // ← change if needed
const NAME = "My Token";
const SYMBOL = "MTK";
const DESCRIPTION = "A devnet practice token.";
// ────────────────────────────────────────────────────────

(async () => {
  try {
    // Irys wants a base58 string, not the JSON array
    const secretKey = bs58.encode(new Uint8Array(wallet));

    const irys = await Uploader(Solana)
      .withWallet(secretKey)
      .withRpc(RPC)
      .devnet();

    // ── 1. Upload the image ─────────────────────────────
    const imageSize = (await fs.promises.stat(IMAGE_PATH)).size;
    const imagePrice = await irys.getPrice(imageSize);
    await irys.fund(imagePrice, 1.2);

   const imageReceipt = await irys.uploadFile(IMAGE_PATH, {
  tags: [{ name: "Content-Type", value: "image/png" }],
});
    const imageUri = `https://gateway.irys.xyz/${imageReceipt.id}`;
    console.log("✅ Image URI:", imageUri);

    // ── 2. Build the metadata JSON ──────────────────────
    const metadata = {
      name: NAME,
      symbol: SYMBOL,
      description: DESCRIPTION,
      image: imageUri,
      external_url: "",
      attributes: [],
      properties: {
        files: [{ uri: imageUri, type: "image/png" }],
      },
    };

    const metadataBuffer = Buffer.from(JSON.stringify(metadata));

    // ── 3. Upload the metadata JSON ─────────────────────
    const metaPrice = await irys.getPrice(metadataBuffer.length);
    await irys.fund(metaPrice, 1.2);

    const metaReceipt = await irys.upload(metadataBuffer, {
      tags: [{ name: "Content-Type", value: "application/json" }],
    });
    const metadataUri = `https://gateway.irys.xyz/${metaReceipt.id}`;
    console.log("✅ Metadata URI:", metadataUri);

    console.log("\n── paste this into spl_update_metadata.ts ──");
    console.log(`uri: "${metadataUri}",`);
  } catch (e) {
    console.error(e);
  }
})();