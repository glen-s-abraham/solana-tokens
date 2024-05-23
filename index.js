const { createMint, getOrCreateAssociatedTokenAccount, getAccount, mintTo, transfer, setAuthority, AuthorityType, burn } = require('@solana/spl-token');
const { Connection, clusterApiUrl, Keypair, LAMPORTS_PER_SOL, PublicKey } = require('@solana/web3.js');
require('dotenv').config();
const base58 = require('bs58');

// Utility function for creating a wallet
const createWallet = () => {
    if (!process.env.PRIVATE_KEY) {
        throw new Error("PRIVATE_KEY environment variable is missing");
    }
    const privateKey = base58.decode(process.env.PRIVATE_KEY);
    return Keypair.fromSecretKey(privateKey);
}

// Utility function for funding a wallet
const fundWallet = async (connection, wallet) => {
    const signature = await connection.requestAirdrop(wallet.publicKey, LAMPORTS_PER_SOL);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
    });
}

// Utility function for getting account balance
const getAccountBalance = async (connection, accountAddress) => {
    const tokenAccInfo = await getAccount(connection, accountAddress);
    return tokenAccInfo.amount;
}

// Utility function for transferring tokens
const transferTokens = async (connection, wallet, token, tokenAccount, recipient, tokenCount) => {
    const toPublicKey = new PublicKey(recipient);
    const toAccount = await getOrCreateAssociatedTokenAccount(connection, wallet, token, toPublicKey);
    const signature = await transfer(
        connection,
        wallet,
        tokenAccount.address,
        toAccount.address,
        wallet.publicKey,
        BigInt(tokenCount) * BigInt(LAMPORTS_PER_SOL)
    );
    await connection.confirmTransaction({ signature });
    return signature;
}

// Utility function for disabling minting
const disableMint = async (connection, wallet, mint) => {
    await setAuthority(connection, wallet, mint, wallet.publicKey, AuthorityType.MintTokens, null);
}

// Utility function for burning tokens
const burnTokens = async (connection, wallet, tokenAccount, token, tokenCount) => {
    await burn(
        connection,
        wallet,
        tokenAccount.address,
        token,
        wallet.publicKey,
        BigInt(tokenCount) * BigInt(LAMPORTS_PER_SOL)
    );
}

// Main function to create and manage tokens
const createToken = async () => {
    try {
        const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
        const wallet = createWallet();
        const balance = await connection.getBalance(wallet.publicKey);

        if (balance < LAMPORTS_PER_SOL) {
            await fundWallet(connection, wallet);
        }

        // Create a new token mint
        const mint = await createMint(connection, wallet, wallet.publicKey, wallet.publicKey, 9);
        console.log("Token address:", mint.toBase58());

        // Get or create the associated token account for the wallet
        const tokenAccount = await getOrCreateAssociatedTokenAccount(connection, wallet, mint, wallet.publicKey);
        console.log("Token account address:", tokenAccount.address.toBase58());

        // Check initial balance
        const initialBalance = await getAccountBalance(connection, tokenAccount.address);
        console.log("Initial Balance:", initialBalance);

        // Mint tokens to the token account
        await mintTo(connection, wallet, mint, tokenAccount.address, wallet.publicKey, BigInt(10000) * BigInt(LAMPORTS_PER_SOL));

        // Check final balance
        const finalBalance = await getAccountBalance(connection, tokenAccount.address);
        console.log("Final Balance:", finalBalance);

        // Transfer tokens
        const transferSignature = await transferTokens(connection, wallet, mint, tokenAccount, '6Sz1Ddx5dxQZ2HRgyWJkhCZxakZENn5KFy8J1Skxm1cx', 10);
        console.log("Transfer Signature:", transferSignature);

        // Burn tokens
        await burnTokens(connection, wallet, tokenAccount, mint, 10);
        const balanceAfterBurn = await getAccountBalance(connection, tokenAccount.address);
        console.log("Balance after burn:", balanceAfterBurn);

        // Disable minting
        await disableMint(connection, wallet, mint);
        console.log("Minting disabled");

    } catch (error) {
        console.error("An error occurred:", error);
        throw error; // Re-throw the error after logging it
    }
}

createToken()
    .then(() => console.log("Done!"))
    .catch(error => {
        console.error("An error occurred during token creation:", error);
    });
