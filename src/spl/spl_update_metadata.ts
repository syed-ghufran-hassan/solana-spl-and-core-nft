import {
  createSignerFromKeypair,
  publicKey,
  signerIdentity,
} from "@metaplex-foundation/umi";
import wallet from "../../devnet-wallet.json";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  updateMetadataAccountV2,
  UpdateMetadataAccountV2InstructionAccounts,
  UpdateMetadataAccountV2InstructionArgs,
  DataV2Args,
} from "@metaplex-foundation/mpl-token-metadata";
import bs58 from "bs58";

const mint = publicKey("8gshBiMrsfQXgvqsSzUfiGXbBtfab9ySThdSXXBWmRSz");
const metadataPda = publicKey("H6ucGCBP2NAKLfFCdWp8zzuY5RcGrUNc2AKNbWNaoGp8");

const umi = createUmi("https://api.devnet.solana.com");

const keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
const signer = createSignerFromKeypair(umi, keypair);
umi.use(signerIdentity(signer));

(async () => {
  try {
    const data: DataV2Args = {
      name: "My Token",
      symbol: "MTK",
      uri: "https://gateway.irys.xyz/BjPWGgBXzGMVemYtN4tvE6wy72WpdJzqXjQRoRrabxRL",
      sellerFeeBasisPoints: 0,
      creators: null,
      collection: null,
      uses: null,
    };

    const accounts: UpdateMetadataAccountV2InstructionAccounts = {
      metadata: metadataPda,
      updateAuthority: signer,
    };

    const args: UpdateMetadataAccountV2InstructionArgs = {
      data,
      newUpdateAuthority: null,
      primarySaleHappened: null,
      isMutable: null,
    };

    const tx = updateMetadataAccountV2(umi, { ...accounts, ...args });
    const result = await tx.sendAndConfirm(umi);
    console.log("update signature:", bs58.encode(Buffer.from(result.signature)));
  } catch (error) {
    console.log("error", error);
  }
})();
