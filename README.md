# Tokenized Carbon Credit Management and Trading System

## 【Introduction of the Tokenized-Carbon Credit Management and Trading (on Sepolia)】

This project is a blockchain-based platform for managing and trading tokenized carbon credits on the Sepolia testnet. The system enables organizations to register carbon reduction projects, submit claims for verified emission reductions, and trade carbon credits as ERC20 tokens on a decentralized marketplace.

### Key Features

- **Project Registration**: Organizations can register carbon reduction projects with baseline emission data
- **Claim Submission**: Project owners can submit claims for verified carbon reductions with evidence stored on IPFS
- **Audit System**: Certified auditors review and verify claims before tokens are issued
- **Tokenization**: Verified carbon reductions are minted as ERC20 tokens (CCT - Carbon Credit Token) representing 1 ton of CO2 each
- **NFT Certificates**: Each verified batch receives a Green NFT certificate as proof of verification
- **Marketplace**: Tokenized credits can be bought and sold on the decentralized marketplace
- **Retirement**: Credits can be permanently retired (burned) to receive a Retirement Certificate NFT

### Smart Contracts

The system consists of five main smart contracts:

1. **CarbonCreditToken (CCT)**: ERC20 token representing carbon credits (1 token = 1 ton CO2)
2. **CarbonCreditRegistry**: Manages projects, claims, audits, and coordinates token/NFT minting
3. **GreenNFTCollection**: ERC721 NFT collection for batch verification certificates
4. **CarbonCreditMarketplace**: Decentralized marketplace for buying and selling carbon credits
5. **RetirementCertificate**: ERC721 NFT collection for retirement certificates

### User Roles

- **Admin**: Deploys contracts and manages auditor roles
- **Auditor**: Reviews and verifies carbon reduction claims
- **Project Owner**: Registers projects and submits claims for verification
- **Buyer**: Purchases carbon credits from the marketplace
- **Retirer**: Retires (burns) carbon credits to offset emissions

### Overall architecture

<Image src="./diagrams/Architecture-Diagram.png">

---

## 【Workflow】

The carbon credit lifecycle follows these steps:

1. **Project Registration**

   - A project owner registers a new carbon reduction project with baseline emissions data
   - The project receives a unique project ID

2. **Claim Submission**

   - Project owner submits a claim for carbon reductions achieved during a specific period
   - Evidence documents are uploaded to IPFS and linked to the claim
   - Claim status: **Pending**

3. **Audit Process**

   - An auditor reviews the claim and evidence
   - If approved: Claim status changes to **Audited**
   - If rejected: Claim status changes to **Rejected**

4. **Token & NFT Issuance** (After Audit Approval)

   - Carbon Credit Tokens (CCT) are minted to the project owner (1 token per ton of CO2 reduced)
   - A Green NFT certificate is minted representing the verified batch
   - Claim status: **Audited**

5. **Marketplace Listing**

   - Project owner can list their carbon credits for sale on the marketplace
   - Credits are escrowed in the marketplace contract
   - Claim status: **OnSale**

6. **Trading**

   - Buyers can purchase carbon credits using ETH
   - Credits are transferred to the buyer
   - Seller receives ETH payment
   - If all credits are sold, claim status: **Sold**

7. **Retirement** (Optional)
   - Credit holders can retire (burn) their tokens to offset emissions
   - A Retirement Certificate NFT is minted as proof of retirement
   - Retired credits are permanently removed from circulation

<Image src="./diagrams/Flow-Diagram.png">

---

## 【Versions】

### Smart Contracts

- **Solidity**: `^0.8.20`
- **Hardhat**: `^2.27.1`
- **OpenZeppelin Contracts**: `^5.4.0`
- **@nomicfoundation/hardhat-toolbox**: `^6.1.0`

### Frontend

- **Node.js**: `v18.x` or higher (recommended)
- **React**: `^18.3.1`
- **TypeScript**: `~5.9.3`
- **Vite**: `^7.2.4`
- **Wagmi**: `^2.19.5`
- **Viem**: `^2.41.2`
- **RainbowKit**: `^2.2.10`
- **TailwindCSS**: `^4.1.18`

### Blockchain Network

- **Network**: Sepolia Testnet
- **Chain ID**: 11155111

---

## 【Setup】

### Prerequisites

- **Node.js** v18.x or higher
- **npm** (comes with Node.js)
- **MetaMask** browser extension
- **Git** (for cloning the repository)

### Setup Wallet by Using MetaMask

1. **Install MetaMask**

   - Visit [metamask.io](https://metamask.io) and install the browser extension
   - Create a new wallet or import an existing one
   - **Important**: Use a test wallet with testnet funds only

2. **Add Sepolia Testnet**

   - Open MetaMask and click the network dropdown
   - Select "Add Network" or "Add a network manually"
   - Enter the following details:
     - **Network Name**: Sepolia
     - **RPC URL**: `https://sepolia.infura.io/v3/YOUR_INFURA_KEY` (or use a public RPC)
     - **Chain ID**: `11155111`
     - **Currency Symbol**: `ETH`
     - **Block Explorer**: `https://sepolia.etherscan.io`

3. **Get Test ETH**

   - Visit a Sepolia faucet to get test ETH:
     - [Alchemy Sepolia Faucet](https://sepoliafaucet.com/)
     - [Infura Sepolia Faucet](https://www.infura.io/faucet/sepolia)
     - [Cloudflare Faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia)
   - Request test ETH to your MetaMask wallet address
   - Wait for the transaction to confirm

4. **Export Private Key** (for deployment)
   - In MetaMask, go to Account Details → Export Private Key
   - Enter your password to reveal the private key
   - **⚠️ WARNING**: Never share your private key or use it with real funds
   - Copy the private key (you'll need it for deployment)

### Deploy to Sepolia Testnet

1. **Clone the Repository**

   ```bash
   git clone <REPO_URL> carbon-credit-blockchain
   cd carbon-credit-blockchain
   ```

2. **Install Smart Contract Dependencies**

   ```bash
   cd smart-contract
   npm install
   ```

3. **Configure Environment Variables**

   - Create a `.env` file in the `smart-contract/` directory:

     ```bash
     cd smart-contract
     touch .env
     ```

   - Add the following to `.env`:

     ```bash
     SEPOLIA_RPC_URL="https://sepolia.infura.io/v3/YOUR_INFURA_KEY"
     PRIVATE_KEY="YOUR_PRIVATE_KEY_FROM_METAMASK"
     ```

   - Replace:
     - `YOUR_INFURA_KEY` with your Infura API key (get one at [infura.io](https://infura.io))
     - `YOUR_PRIVATE_KEY_FROM_METAMASK` with the private key you exported from MetaMask

4. **Deploy Smart Contracts**

   ```bash
   npx hardhat run scripts/deploy.js --network sepolia
   ```

5. **Save Contract Addresses**

   - After deployment, the script will output all contract addresses
   - Copy these addresses - you'll need them for the frontend configuration
   - The deployment info is also saved in `smart-contract/deployments/`

6. **Copy ABI Files to Frontend**

   ```bash
   # Create ABI directory in frontend
   mkdir -p ../frontend/src/contracts/abi/

   # Copy ABI files
   cp artifacts/contracts/CarbonCreditToken.sol/CarbonCreditToken.json ../frontend/src/contracts/abi/
   cp artifacts/contracts/CarbonCreditRegistry.sol/CarbonCreditRegistry.json ../frontend/src/contracts/abi/
   cp artifacts/contracts/GreenNFTCollection.sol/GreenNFTCollection.json ../frontend/src/contracts/abi/
   cp artifacts/contracts/CarbonCreditMarketplace.sol/CarbonCreditMarketplace.json ../frontend/src/contracts/abi/
   cp artifacts/contracts/RetirementCertificate.sol/RetirementCertificate.json ../frontend/src/contracts/abi/
   ```

### Set Up Frontend

1. **Install Frontend Dependencies**

   ```bash
   cd ../frontend
   npm install
   ```

2. **Configure Contract Addresses**

   - Open `frontend/src/contracts/addresses.ts`
   - Update the contract addresses with the ones from your deployment:
     ```typescript
     export const CONTRACT_ADDRESSES = {
       CCT: "0x...", // CarbonCreditToken address
       REGISTRY: "0x...", // CarbonCreditRegistry address
       MARKETPLACE: "0x...", // CarbonCreditMarketplace address
       GREEN_NFT_COLLECTION: "0x...", // GreenNFTCollection address
       RETIREMENT_CERTIFICATE: "0x...", // RetirementCertificate address
     };
     ```

3. **Start the Development Server**

   ```bash
   npm run dev
   ```

4. **Connect Your Wallet**

   - Open the frontend in your browser (usually `http://localhost:5173`)
   - Click "Connect Wallet" button
   - Select MetaMask and approve the connection
   - Make sure MetaMask is connected to Sepolia network

5. **Grant Roles** (First Time Setup)
   - As the deployer (admin), you need to:
     - Add auditors using the admin panel (if available) or directly through the contract
     - Grant MINTER_ROLE to the Registry contract (should be done automatically during deployment)

### Verify Everything Works

1. **Test Project Registration**

   - Connect your wallet as a project owner
   - Register a new project with a name and baseline emissions

2. **Test Claim Submission**

   - Submit a claim for your project with reduction data and IPFS evidence link

3. **Test Audit** (as Auditor)

   - Connect with an auditor wallet
   - Review and approve/reject pending claims

4. **Test Marketplace**

   - List credits for sale
   - Purchase credits with another wallet

5. **Test Retirement**
   - Retire some credits to receive a Retirement Certificate NFT

---

## Additional Notes

- **IPFS**: Evidence documents and NFT metadata should be stored on IPFS. You can use services like [Pinata](https://pinata.cloud) or [Web3.Storage](https://web3.storage)
- **Gas Costs**: All transactions require ETH for gas fees. Make sure your wallet has sufficient test ETH
- **Network**: Always ensure MetaMask is connected to Sepolia testnet when using the frontend
- **Security**: Never use real private keys or mainnet wallets with this testnet setup

---

## Troubleshooting

- **"Insufficient funds"**: Make sure your wallet has test ETH on Sepolia
- **"Wrong network"**: Switch MetaMask to Sepolia testnet
- **"Contract not found"**: Verify contract addresses in `addresses.ts` match your deployment
- **"ABI errors"**: Make sure you've copied the latest ABI files after redeploying contracts

---

## Support

For issues or questions, please refer to the project documentation or contact the development team.
