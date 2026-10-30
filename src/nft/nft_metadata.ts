import {
  createSignerFromKeypair,
  signerIdentity,
} from "@metaplex-foundation/umi";
import wallet from "../../devnet-wallet.json";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";

const umi = createUmi(
  process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
);

const keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
const signer = createSignerFromKeypair(umi, keypair);

umi.use(irysUploader({ address: "https://devnet.irys.xyz/" }));
umi.use(signerIdentity(signer));

(async () => {
  try {
    // ── EDIT: paste the URI printed by nft_image.ts ───────
    const image = "https://gateway.irys.xyz/Cd2jJm8KHNutY6EMtrKZrwC5Zi92bdLoPfGahwJUhE5r"; 
    // ──────────────────────────────────────────────────────

    const metadata = {
      name: "My NFT",
      description: "An NFT minted on Solana devnet via mpl-core.",
      image,
      external_url: "",
      attributes: [
        { trait_type: "Background", value: "Blue" },
        { trait_type: "Rarity", value: "Common" },
      ],
      properties: {
        files: [{ uri: image, type: "image/jpeg" }],
        category: "image",
      },
    };

    const myUri = await umi.uploader.uploadJson(metadata);
    console.log(`metadata uri: ${myUri}`);
  } catch (error) {
    console.log("error", error);
  }
})();