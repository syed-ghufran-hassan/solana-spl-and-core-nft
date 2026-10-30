# Turbine SPL + NFT Project — Devnet Build Log

A complete walkthrough of building an SPL token and a Metaplex Core NFT on Solana devnet, including every error encountered and how it was fixed.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Final On-Chain State](#final-on-chain-state)
- [Errors & Fixes](#errors--fixes)
  - [SPL Token Errors](#spl-token-errors)
  - [Irys Upload Errors](#irys-upload-errors)
  - [NFT Errors](#nft-errors)
  - [CLI / Environment Errors](#cli--environment-errors)
- [Scripts Reference](#scripts-reference)
- [Package.json Scripts](#packagejson-scripts)
- [Lessons Learned](#lessons-learned)

---

## Project Overview

Two deliverables built end-to-end on Solana **devnet**:

1. **SPL Token** — 1,000,000 supply with 9 decimals, on-chain metadata, and a live image hosted on Irys.
2. **Metaplex Core NFT** — a single Core asset with off-chain metadata and a live image hosted on Irys.

All scripts live under `src/spl/` and `src/nft/`, and sign with `devnet-wallet.json` at the project root.

---

## Final On-Chain State

### SPL Token

| Field | Value |
|---|---|
| Wallet | `GQE5C8uJy7anxdJ1cF3BbT9MmYAZQoi1DMWPRz8Rer56` |
| Mint | `8gshBiMrsfQXgvqsSzUfiGXbBtfab9ySThdSXXBWmRSz` |
| Supply | 1,000,000 (9 decimals) |
| Metadata PDA | `H6ucGCBP2NAKLfFCdWp8zzuY5RcGrUNc2AKNbWNaoGp8` |
| Owner ATA | `EErdkGWP8Uzgq3gKKSDPA2uBUKASgvqaK9Vsboayg8Ej` |
| Recipient ATA | `9pHN55BhqK8Ychm1GzxT5qtdffYpj23jm38QxanL1tx7` |
| Metadata URI | `https://gateway.irys.xyz/BjPWGgBXzGMVemYtN4tvE6wy72WpdJzqXjQRoRrabxRL` |

**Verify on Explorer:**
- Mint: https://explorer.solana.com/address/8gshBiMrsfQXgvqsSzUfiGXbBtfab9ySThdSXXBWmRSz?cluster=devnet
- Solscan: https://solscan.io/token/8gshBiMrsfQXgvqsSzUfiGXbBtfab9ySThdSXXBWmRSz?cluster=devnet

### NFT (Metaplex Core)

| Field | Value |
|---|---|
| Asset | `6THSrPANqwXAYjpeaYFMc1MEDW9HHQsmhPcz55xSm8MU` |
| Mint signature | `5DRhHos27SeQEgmLVktcvjoCibCL7m5WqiKz9GAhpeLdH164of4gvNTFgDDkaGXUeUT4qjgg7NapZMiDzgQyhzMS` |
| Image URI | `https://gateway.irys.xyz/Cd2jJm8KHNutY6EMtrKZrwC5Zi92bdLoPfGahwJUhE5r` |
| Metadata URI | `https://gateway.irys.xyz/9qpouQwtGsPy53cU17F2a3NMsMzXnrUuABRbxLqZaquW` |

**View on Metaplex Core Explorer:**
```
https://core.metaplex.com/explorer/6THSrPANqwXAYjpeaYFMc1MEDW9HHQsmhPcz55xSm8MU?env=devnet
```

**Other explorers:**
- Solana Explorer: https://explorer.solana.com/address/6THSrPANqwXAYjpeaYFMc1MEDW9HHQsmhPcz55xSm8MU?cluster=devnet
- Solana.fm: https://solana.fm/address/6THSrPANqwXAYjpeaYFMc1MEDW9HHQsmhPcz55xSm8MU?cluster=devnet-solana

> **Note:** When viewing on `core.metaplex.com`, make sure the network selector (top-right) is set to **Devnet**. The site defaults to Mainnet and your asset won't appear until you switch.

---

## Errors & Fixes

### SPL Token Errors

#### 1. `ENOENT: no such file or directory, open 'file-path'`

**Symptom**
```
Error: ENOENT: no such file or directory, open 'file-path'
    at async open (node:internal/fs/promises:639:25)
```

**Cause**
The script contained a literal placeholder string `"file-path"` that was never replaced with an actual filesystem path. `readFile("file-path")` looks for a file named exactly `file-path` in the current directory.

**Fix**
Replace `"file-path"` with a real path to an existing image, e.g.:

```ts
const image = await readFile("./assets/nft.jpeg");
```

**Lesson**
When copy-pasting tutorial code, always `grep` for placeholder strings (`file-path`, `<YOUR_...>`, `YOUR_MINT`, `example.com`) before running.

---

#### 2. `spl:init` runs silently and creates nothing

**Symptom**
```
$ npm run spl:init

> scripts-solana-2@1.0.0 spl:init
> npx ts-node src/spl/spl_init.ts

zee-tech@zee-tech-Y11C:~/...$
```

No output, no error, and the subsequent commands all fail with `AccountNotFound`.

**Cause**
The script body was an empty stub:

```ts
(async () => {
  try {
    // ← nothing here
  } catch (error) {
    console.log(error);
  }
})();
```

Every "success" message in the downstream scripts was based on addresses computed locally, never sent to the chain.

**Fix**
Fill in the actual initialization logic:

```ts
const payer = await createKeyPairSignerFromBytes(new Uint8Array(wallet));
const mint = await generateKeyPairSigner();

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
      m
    ),
  (m) =>
    appendTransactionMessageInstruction(
      getInitializeMintInstruction({
        mint: mint.address,
        decimals: 9,
        mintAuthority: payer.address,
      }),
      m
    )
);

const signed = await signTransactionMessageWithSigners(tx);
assertIsTransactionWithBlockhashLifetime(signed);
await sendAndConfirm(signed, { commitment: "confirmed" });

// Persist for next scripts
fs.writeFileSync("mint-address.txt", mint.address);
```

**Lesson**
A script that prints nothing but exits 0 is suspicious. Always log wallet, mint, and signature explicitly.

---

#### 3. `AccountNotFound` when querying an ATA

**Symptom**
```
$ solana account FsrnCkBDN6XFib16U7Rs9ey3SpB4u1iefAvLBXGYDQ4b --url devnet
Error: AccountNotFound: pubkey=FsrnCkBDN6XFib16U7Rs9ey3SpB4u1iefAvLBXGYDQ4b
```

**Cause**
The ATA was *derived* and printed locally but never created on-chain. Address derivation is a pure computation — no transaction is required to compute an ATA address, so printing it proves nothing.

**Fix**
Create the ATA explicitly with the `create-associated-token-account` instruction:

```ts
const createAtaIx = await getCreateAssociatedTokenInstructionAsync({
  payer: signer,
  mint,
  owner: signer.address,
});
```

Or from CLI:
```bash
spl-token create-account <MINT> --owner <WALLET_PUBKEY> \
  --fee-payer devnet-wallet.json --url https://api.devnet.solana.com
```

**Lesson**
"Your ata is: X" ≠ "ATA X exists." Confirm with `solana account X` or by checking the mint transaction on Explorer.

---

#### 4. `TS2345` — `sendAndConfirm` incompatible with signed transaction type

**Symptom**
```
error TS2345: Argument of type 'FullySignedTransaction & ... & TransactionWithLifetime'
  is not assignable to parameter of type '... & { lifetimeConstraint: ... }'.
  Type 'TransactionBlockhashLifetime | TransactionDurableNonceLifetime'
  is not assignable to type 'Omit<TransactionBlockhashLifetime, "blockhash">'.
  Property 'lastValidBlockHeight' is missing in type 'TransactionDurableNonceLifetime'.
```

**Cause**
`signTransactionMessageWithSigners` returns a union type: **blockhash** lifetime **or** **durable nonce** lifetime. `sendAndConfirmTransactionFactory` only accepts the blockhash variant, so TypeScript refuses to compile until the type is narrowed.

**Fix**
Import and call the assertion before `sendAndConfirm`:

```ts
import { assertIsTransactionWithBlockhashLifetime } from "@solana/kit";

const signed = await signTransactionMessageWithSigners(tx);
assertIsTransactionWithBlockhashLifetime(signed);   // ← narrows the type
await sendAndConfirm(signed, { commitment: "confirmed" });
```

**Lesson**
`@solana/kit` uses assertion helpers to narrow unions. If you see a `Types of property ... are incompatible` error, look for an `assertIs...` helper in the SDK.

---

#### 5. Wrong mint address in downstream scripts

**Symptom**
Scripts run "successfully" but on-chain nothing matches.

**Cause**
After `spl_init.ts` creates a fresh mint, the subsequent scripts still hardcoded the tutorial's mint address (`E2Jazz2VXcVL9RZkn6ZFA4q1YGvgEvrns3Gr6w72DC4w`).

**Fix**
- Either have `spl_init.ts` persist the address: `fs.writeFileSync("mint-address.txt", mint.address);`
- And have downstream scripts read it:
  ```ts
  const mint = address(fs.readFileSync("mint-address.txt", "utf-8").trim());
  ```

**Lesson**
Do not hardcode generated addresses in scripts. Use files, env vars, or a shared config module.

---

#### 6. `spl-token display` shows nothing for metadata

**Symptom**
```
$ spl-token display $MINT
SPL Token Mint
  Address: 8gshBiMrs...
  Supply: 1000000000000000
  ...
```

No name/symbol/URI — even though `spl:metadata` "succeeded."

**Cause**
`spl-token display` reads the **SPL Token program**'s mint account, which does **not** store Metaplex metadata. The name/symbol/URI live in a **separate PDA** owned by the **Token Metadata** program.

**Fix**
Read the metadata PDA instead:

```ts
// Umi script
const metadataPda = publicKey("H6ucGCBP2NAKLfFCdWp8zzuY5RcGrUNc2AKNbWNaoGp8");
const account = await fetchMetadata(umi, metadataPda);
console.log(account.name, account.symbol, account.uri);
```

Or open the **mint's** page on Explorer (not the metadata PDA page) — the "Metadata" section decodes it for you.

**Lesson**
SPL Token and Token Metadata are two separate programs with two separate accounts. `spl-token` CLI only knows the first.

---

#### 7. `jsonParsed` returns empty for Token Metadata accounts

**Symptom**
```bash
curl ... '{"method":"getAccountInfo","params":["H6uc...",{"encoding":"jsonParsed"}]}' | grep uri
# → empty
```

**Cause**
`jsonParsed` encoding only works for programs the RPC has explicit decoders for. Token Metadata is **not** one of them — it returns raw base64/base58 bytes.

**Fix**
Decode manually with a library, or use Umi's `fetchMetadata` (recommended). Quick raw grep:

```bash
curl -s ... '{"method":"getAccountInfo","params":["H6uc...",{"encoding":"base64"}]}' \
  | grep -o '"data":\["[^"]*"' \
  | sed 's/.*\["//; s/"$//' \
  | base64 -d 2>/dev/null | strings | grep -o 'https://gateway.irys.xyz/[A-Za-z0-9]*'
```

**Lesson**
`jsonParsed` works for: SPL Token, SPL Token-2022, System Program. Everything else returns raw bytes.

---

#### 8. `Missing script: "spl:update-metadata"`

**Symptom**
```
npm error Missing script: "spl:update-metadata"
```

**Cause**
The `package.json` `"scripts"` block didn't contain the entry.

**Fix**
Add to `package.json`:

```json
"spl:update-metadata": "npx ts-node src/spl/spl_update_metadata.ts"
```

Or run directly: `npx ts-node src/spl/spl_update_metadata.ts`

**Lesson**
`npm run X` only works if `X` is defined in `package.json`. `npx ts-node path/to/file.ts` bypasses this.

---

#### 9. `Cannot find module './spl_update_metadata.ts'`

**Symptom**
```
Error: Cannot find module './spl_update_metadata.ts'
```

**Cause**
The file was never actually saved to disk. It was pasted in chat, not created.

**Fix**
Create it deterministically without an editor:

```bash
cat > src/spl/spl_update_metadata.ts << 'EOF'
// ... full file content ...
EOF
```

Then verify:
```bash
ls -la src/spl/spl_update_metadata.ts
```

**Lesson**
Chat pastes don't create files. Use `cat > file << 'EOF'` for guaranteed file creation, then `ls` to confirm.

---

#### 10. Used `createMetadataAccountV3` to update existing metadata

**Symptom**
Would fail with `account already in use` if executed — metadata PDA already existed.

**Cause**
`createMetadataAccountV3` only works **once** per mint (it creates the PDA). To modify an existing PDA you must use `updateMetadataAccountV2`.

**Fix**

| | Create (first time) | Update (subsequent) |
|---|---|---|
| Instruction | `createMetadataAccountV3` | `updateMetadataAccountV2` |
| Accounts | `mint`, `mintAuthority`, `payer`, `updateAuthority` | `metadata` (the PDA), `updateAuthority` |
| Args | `data`, `isMutable`, `collectionDetails` | `data`, `newUpdateAuthority`, `primarySaleHappened`, `isMutable` |

**Lesson**
Metadata is a PDA, not a mutable field on the mint. First write = create; subsequent writes = update.

---

### Irys Upload Errors

#### 11. `TypeError: no properties in common with type 'CreateAndUploadOptions'`

**Symptom**
```
error TS2559: Type '{ name: string; value: string; }[]' has no properties in common
with type 'CreateAndUploadOptions'.
```

**Cause**
`irys.uploadFile(path, options)` expects an options **object** (`{ tags: [...] }`), not a bare array.

**Fix**

```ts
// ❌ wrong
await irys.uploadFile(IMAGE_PATH, [
  { name: "Content-Type", value: "image/png" },
]);

// ✅ correct
await irys.uploadFile(IMAGE_PATH, {
  tags: [{ name: "Content-Type", value: "image/png" }],
});
```

**Lesson**
Read the SDK's TypeScript signature when you see `has no properties in common` — it usually means the shape is wrong, not the types.

---

#### 12. `402 error: Not enough balance for transaction`

**Symptom**
```
Error: 402 error: Not enough balance for transaction
    at ChunkingUploader.runUpload (...)
```

**Cause**
Two possible causes:
1. Irys node hasn't yet credited the funding transaction (devnet propagation lag).
2. The uploaded file is too big for the funded amount.

**Fix**
Add a **fee multiplier** (20% buffer) to `irys.fund()`:

```ts
// ❌ before
await irys.fund(imagePrice);

// ✅ after
await irys.fund(imagePrice, 1.2);
```

If that still fails:
- Wait 30–60 seconds between `fund()` and `upload()`.
- Use the [Irys faucet](https://irys.xyz/faucet) to get free devnet credits.
- Switch to a paid RPC (Helius, QuickNode, Alchemy) for faster confirmation.

**Lesson**
Funding has latency on devnet. Multiplier-tips are the standard workaround.

---

#### 13. Irys gateway returns empty (302 → nothing)

**Symptom**
```
$ curl -s https://gateway.irys.xyz/<TX_ID>
zee-tech@...$ (empty)

$ curl -I https://gateway.irys.xyz/<TX_ID>
HTTP/2 302
location: https://<cdn>.devnet-1.datasprite-cdn.com/<TX_ID>/
```

**Cause**
Irys CDN propagation lag. The transaction is on-chain (verified via GraphQL) but the CDN hasn't picked it up yet.

**Fix**
1. **Verify the transaction exists** with GraphQL:
   ```graphql
   query {
     transactions(ids: ["<TX_ID>"]) {
       edges { node { id timestamp tags { name value } } }
     }
   }
   ```
   Endpoint: `https://devnet.irys.xyz/graphql`

2. **Wait 2–10 minutes**, then retry the GET:
   ```bash
   curl -sL https://gateway.irys.xyz/<TX_ID>
   ```

3. If it never resolves, **re-upload** for a new TX ID (different CDN shard).

**Lesson**
Irys receipts are instant; gateway availability lags. Never point on-chain metadata at a URI until you can `curl` it and get the body.

---

#### 14. `curl -I` (HEAD) doesn't show `Content-Type` on Irys

**Symptom**
```bash
curl -I https://gateway.irys.xyz/<URI> | grep -i content-type
# → no output
```

**Cause**
`-I` sends a HEAD request. Irys returns a 302 redirect for the HEAD, and the content-type is only set on the **final response** after following redirects. HEAD doesn't follow by default and often skips headers on redirects.

**Fix**
Use a GET that follows redirects and prints only headers:

```bash
# Option A: dump headers to stdout, discard body
curl -sL -D - -o /dev/null https://gateway.irys.xyz/<URI> | grep -i '^content-type'

# Option B: print just the content-type (cleanest)
curl -sL -o /dev/null -w "%{content_type}\n" https://gateway.irys.xyz/<URI>
```

**Lesson**
`-I` (HEAD) is not equivalent to `-L` (follow) with a body-less GET. For content-type checks on redirecting endpoints, use `-sL -w "%{content_type}" -o /dev/null`.

---

### NFT Errors

#### 15. Empty NFT scripts (same stub pattern as SPL)

**Symptom**
`nft_image.ts`, `nft_metadata.ts`, and `nft_mint.ts` all ran silently or printed nothing useful.

**Cause**
Same root issue as `spl_init.ts` — the core logic was commented out or missing.

**Fix**
Fill each script with the real implementation:

**`nft_image.ts`**
```ts
const image = await readFile("./assets/nft.jpeg");
const file = createGenericFile(image, "nft.jpeg", {
  contentType: "image/jpeg",
});
const [myUri] = await umi.uploader.upload([file]);
console.log("Your image URI:", myUri);
```

**`nft_metadata.ts`**
```ts
const image = "https://gateway.irys.xyz/<IMAGE_URI>";
const metadata = {
  name: "My NFT",
  description: "...",
  image,
  external_url: "",
  attributes: [{ trait_type: "Background", value: "Blue" }],
  properties: {
    files: [{ uri: image, type: "image/jpeg" }],
    category: "image",
  },
};
const myUri = await umi.uploader.uploadJson(metadata);
console.log(`metadata uri: ${myUri}`);
```

**`nft_mint.ts`**
```ts
const metadataUri = "https://gateway.irys.xyz/<METADATA_URI>";
const asset = generateSigner(umi);
const tx = await create(umi, {
  asset,
  name: "My NFT",
  uri: metadataUri,
}).sendAndConfirm(umi);
const signature = bs58.encode(tx.signature);
console.log(`signature: ${signature}`);
console.log(`asset:     ${asset.publicKey}`);
```

**Lesson**
Tutorial repos are often scaffolded stubs. Run each script and inspect output before building on top of it.

---

#### 16. `base58.deserialize(tx.signature)[0]` fails / throws

**Symptom**
```
TypeError: Expected a base58 encoded string
```

**Cause**
`tx.signature` from `sendAndConfirm` is already a `Uint8Array` (bytes), not a base58-encoded string. `base58.deserialize` expects a string input.

**Fix**
Use `bs58.encode()` (from the `bs58` package) to convert **bytes → string**:

```ts
import bs58 from "bs58";
const signature = bs58.encode(tx.signature);
```

Your original code went in the wrong direction: `base58.deserialize(bytes)` tried to parse bytes as a string.

**Lesson**
Two base58 libraries exist in the Solana ecosystem:
- `bs58` — `bs58.encode(bytes)` → string, `bs58.decode(string)` → bytes
- `@solana/kit`'s `base58` (from `@solana/kit`) — different API. Don't mix them.

---

#### 17. Trailing space in metadata URI

**Symptom**
The hardcoded URI `"https://gateway.irys.xyz/BihKZnhMCvxN3i34cv25eEyFgUvBVGJQn1Gp11D4LxEi "` — notice the space before the closing quote.

**Cause**
Copy-paste from a terminal output that included a trailing space.

**Fix**
Remove the space. Better: validate URIs before minting:

```ts
const metadataUri = "https://gateway.irys.xyz/BihKZnhMCvxN3i34cv25eEyFgUvBVGJQn1Gp11D4LxEi";
// trim whitespace defensively:
const cleanUri = metadataUri.trim();
```

**Lesson**
URLs with trailing spaces often resolve to 404 because the space gets URL-encoded as `%20` at the end of the path. Always `.trim()` untrusted strings.

---

### CLI / Environment Errors

#### 18. `solana airdrop` rate limited

**Symptom**
```
Error: airdrop request failed. This can happen when the rate limit is reached.
```

**Cause**
The public devnet faucet rate-limits by IP and wallet.

**Fix**
In order of preference:

1. **Web faucets** (fastest):
   - https://faucet.solana.com
   - https://solfaucet.com
   - https://faucet.quicknode.com/solana/devnet

2. **Retry with smaller amount**: `solana airdrop 0.5`

3. **Local validator** for heavy dev: `solana-test-validator` in a separate terminal, then `solana config set --url localhost`

**Lesson**
Don't rely on `solana airdrop` for iterative development. Use web faucets or a local validator.

---

#### 19. Funded wrong wallet (CLI wallet ≠ script wallet)

**Symptom**
Scripts still failed with "insufficient funds" even though `solana balance` showed SOL.

**Cause**
Two different wallets were in play:
- `solana` CLI uses `~/.config/solana/id.json`
- Project scripts use `devnet-wallet.json` (imported directly)

They can be completely different keypairs → different addresses → different balances.

**Fix**
Fund the wallet the **scripts** actually use:

```bash
# Get the script wallet's public key
solana-keygen pubkey devnet-wallet.json

# Fund that address via faucet
```

Verify:
```bash
solana balance devnet-wallet.json --url https://api.devnet.solana.com
```

**Lesson**
Always know which keypair your script signs with. `solana-keygen pubkey <path>` is the authoritative way to find it.

---

#### 20. `$MINT` shell variable empty in new command

**Symptom**
```
$ spl-token display $MINT --url devnet
error: The following required arguments were not provided:
    <TOKEN_ADDRESS>
```

**Cause**
Shell variables are scoped to the current shell session. Setting `MINT=...` in one prompt doesn't persist to a later command if the session reset, or if the export was never made.

**Fix**
Re-set it, or inline the address:

```bash
# Option A: set again
MINT=8gshBiMrsfQXgvqsSzUfiGXbBtfab9ySThdSXXBWmRSz
spl-token display $MINT --url devnet

# Option B: inline
spl-token display 8gshBiMrsfQXgvqsSzUfiGXbBtfab9ySThdSXXBWmRSz --url devnet

# Option C: persist to shell profile
echo 'export MINT=8gshBiMrsfQXgvqsSzUfiGXbBtfab9ySThdSXXBWmRSz' >> ~/.bashrc
source ~/.bashrc
```

**Lesson**
Use `echo "MINT=$MINT"` to sanity-check variables before using them in commands.

---

## Scripts Reference

### `src/spl/spl_init.ts`
Creates the mint account and initializes it (9 decimals, wallet as mint authority). Saves `mint-address.txt`.

### `src/spl/spl_metadata.ts`
Attaches initial Metaplex Token Metadata (name, symbol, URI) to the mint.

### `src/spl/spl_update_metadata.ts`
Updates an existing metadata PDA (used to fix the placeholder URI to point at Irys).

### `src/spl/spl_mint.ts`
Creates the owner ATA and mints 1,000,000 tokens into it.

### `src/spl/spl_transfer.ts`
Transfers 1,000 tokens to a recipient ATA (creates recipient ATA if missing).

### `src/spl/irys_upload.ts`
Uploads `assets/logo.png` + a `metadata.json` to Irys devnet, prints both URIs.

### `src/nft/nft_image.ts`
Uploads a JPEG to Irys, prints the image URI.

### `src/nft/nft_metadata.ts`
Builds a Metaplex Core JSON metadata object, uploads it to Irys, prints the metadata URI.

### `src/nft/nft_mint.ts`
Mints a Metaplex Core asset pointing at the metadata URI, prints signature + asset address.

---

## Package.json Scripts

```json
"scripts": {
  "spl:init":            "npx ts-node src/spl/spl_init.ts",
  "spl:metadata":        "npx ts-node src/spl/spl_metadata.ts",
  "spl:update-metadata": "npx ts-node src/spl/spl_update_metadata.ts",
  "spl:mint":            "npx ts-node src/spl/spl_mint.ts",
  "spl:transfer":        "npx ts-node src/spl/spl_transfer.ts",
  "irys:upload":         "npx ts-node src/spl/irys_upload.ts",
  "nft:image":           "npx ts-node src/nft/nft_image.ts",
  "nft:metadata":        "npx ts-node src/nft/nft_metadata.ts",
  "nft:mint":            "npx ts-node src/nft/nft_mint.ts"
}
```

---

## Lessons Learned

1. **Silent success is suspicious.** A script that prints nothing but exits 0 is probably a stub. Log every address, signature, and URI.

2. **Derivation ≠ existence.** Computing an ATA or PDA address is pure math. The account only exists after a transaction creates it. Verify with `solana account <addr>`.

3. **`jsonParsed` is program-specific.** It works for SPL Token / Token-2022 / System Program only. Token Metadata returns raw bytes — use a library or Explorer.

4. **Irys CDN lags.** A successful upload receipt does not mean the gateway serves the content immediately. Always `curl -sL` the URI before writing it on-chain.

5. **Use `-sL -w "%{content_type}"`** for content-type checks, never `curl -I` on redirecting endpoints.

6. **`bs58.encode()` ≠ `base58.deserialize()`.** Know your library; know your direction.

7. **Fund the wallet the scripts use** — not the CLI wallet. Confirm with `solana-keygen pubkey <path>`.

8. **Multiplier-tip funding** (`irys.fund(price, 1.2)`) is the standard Irys workaround for 402 errors.

9. **Placeholder strings are landmines.** `"file-path"`, `"<YOUR_URI>"`, `"example.com"` — grep for these before every run.

10. **Metaplex Core is different from Token Metadata.** Core assets use their own program (`CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d`), their own JSON schema, and their own CLI/umi tooling (`mpl-core`, not `mpl-token-metadata`).

11. **Devnet Irys uploads expire (~60 days).** For anything permanent, re-upload to mainnet Irys / Arweave, or mirror to a permanent host.

12. **Don't commit wallet files.** `devnet-wallet.json`, `mint.json`, `mint-address.txt` should all be in `.gitignore`.

---

## .gitignore (recommended)

```gitignore
node_modules/
dist/
.env
.env.*
devnet-wallet.json
mint.json
mint-address.txt
*.log
```

---

## Reference Links

### Project artifacts
- **NFT (Metaplex Core Explorer):** https://core.metaplex.com/explorer/6THSrPANqwXAYjpeaYFMc1MEDW9HHQsmhPcz55xSm8MU?env=devnet
- **NFT (Solana Explorer):** https://explorer.solana.com/address/6THSrPANqwXAYjpeaYFMc1MEDW9HHQsmhPcz55xSm8MU?cluster=devnet
- **SPL Token (Solana Explorer):** https://explorer.solana.com/address/8gshBiMrsfQXgvqsSzUfiGXbBtfab9ySThdSXXBWmRSz?cluster=devnet
- **SPL Token (Solscan):** https://solscan.io/token/8gshBiMrsfQXgvqsSzUfiGXbBtfab9ySThdSXXBWmRSz?cluster=devnet
- **Token Metadata URI:** https://gateway.irys.xyz/BjPWGgBXzGMVemYtN4tvE6wy72WpdJzqXjQRoRrabxRL
- **NFT Image URI:** https://gateway.irys.xyz/Cd2jJm8KHNutY6EMtrKZrwC5Zi92bdLoPfGahwJUhE5r
- **NFT Metadata URI:** https://gateway.irys.xyz/9qpouQwtGsPy53cU17F2a3NMsMzXnrUuABRbxLqZaquW

### Documentation
- [Solana Kit docs](https://github.com/anza-xyz/kit)
- [SPL Token program](https://spl.solana.com/token)
- [Metaplex Token Metadata](https://www.metaplex.com/docs/smart-contracts/token-metadata)
- [Metaplex Core](https://www.metaplex.com/docs/smart-contracts/core)
- [Metaplex Core JSON schema](https://www.metaplex.com/docs/smart-contracts/core/json-schema)
- [Irys devnet faucet](https://irys.xyz/faucet)
- [Solana devnet faucet](https://faucet.solana.com)