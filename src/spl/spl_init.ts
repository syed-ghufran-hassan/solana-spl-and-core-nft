import {
  appendTransactionMessageInstruction,
  assertIsTransactionWithBlockhashLifetime, // <-- added
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  generateKeyPairSigner,
  getSignatureFromTransaction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import {
  getInitializeMintInstruction,
  getMintSize,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import { getCreateAccountInstruction } from "@solana-program/system";
import fs from "fs";

import wallet from "../../devnet-wallet.json";

const rpc = createSolanaRpc("https://api.devnet.solana.com");
const rpcSubscriptions = createSolanaRpcSubscriptions("wss://api.devnet.solana.com");

(async () => {
  try {
    const payer = await createKeyPairSignerFromBytes(new Uint8Array(wallet));
    console.log("Wallet:", payer.address);

    const mint = await generateKeyPairSigner();
    console.log("Mint:  ", mint.address);

    const space = BigInt(getMintSize());
    const lamports = await rpc.getMinimumBalanceForRentExemption(space).send();

    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

    const tx = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(payer, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
      (m) =>
        appendTransactionMessageInstruction(
          getCreateAccountInstruction({
            payer,
            newAccount: mint,
            lamports,
            space,
            programAddress: TOKEN_PROGRAM_ADDRESS,
          }),
          m,
        ),
      (m) =>
        appendTransactionMessageInstruction(
          getInitializeMintInstruction({
            mint: mint.address,
            decimals: 9,
            mintAuthority: payer.address,
          }),
          m,
        ),
    );

    const signed = await signTransactionMessageWithSigners(tx);

    // ↓ THIS is the line that fixes TS2345
    assertIsTransactionWithBlockhashLifetime(signed);

    const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
    await sendAndConfirm(signed, { commitment: "confirmed" });

    console.log("Signature:", getSignatureFromTransaction(signed));

    fs.writeFileSync("mint-address.txt", mint.address);
    console.log("Saved mint address → mint-address.txt");
  } catch (error) {
    console.log(error);
  }
})();