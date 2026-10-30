import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import wallet from "../../devnet-wallet.json";
import {
  createSignerFromKeypair,
  generateSigner,
  signerIdentity,
} from "@metaplex-foundation/umi";
import { create, mplCore } from "@metaplex-foundation/mpl-core";
import bs58 from "bs58";

const umi = createUmi(
  process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
);

const keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
const signer = createSignerFromKeypair(umi, keypair);

umi.use(signerIdentity(signer));
umi.use(mplCore());

(async () => {
  try {
    const metadataUri = "https://gateway.irys.xyz/9qpouQwtGsPy53cU17F2a3NMsMzXnrUuABRbxLqZaquW";
    const asset = generateSigner(umi);

    const tx = await create(umi, {
      asset,
      name: "My NFT",
      uri: metadataUri,
    }).sendAndConfirm(umi);

    const signature = bs58.encode(tx.signature);
    console.log(`signature: ${signature}`);
    console.log(`asset:     ${asset.publicKey}`);
  } catch (e) {
    console.log(`error ${e}`);
  }
})();