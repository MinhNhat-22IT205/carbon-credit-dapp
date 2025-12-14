// scripts/deploy.js
const { ethers } = require("hardhat");

async function main() {
  // Get deployer account
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with account:", deployer.address);
  console.log(
    "Account balance:",
    ethers.formatEther(await deployer.provider.getBalance(deployer.address)),
    "ETH"
  );

  // ===================================================================
  // 1. Deploy CarbonCreditToken (CCT - ERC20)
  // ===================================================================
  console.log("\nDeploying CarbonCreditToken...");
  const CarbonCreditToken = await ethers.getContractFactory(
    "CarbonCreditToken"
  );
  const cct = await CarbonCreditToken.deploy();
  await cct.waitForDeployment();
  const cctAddress = await cct.getAddress();
  console.log("CarbonCreditToken deployed to:", cctAddress);

  // ===================================================================
  // 2. Deploy GreenNFTCollection (Single ERC721 collection for all batches)
  // ===================================================================
  console.log("\nDeploying GreenNFTCollection...");
  const GreenNFTCollection = await ethers.getContractFactory(
    "GreenNFTCollection"
  );
  const greenNFT = await GreenNFTCollection.deploy();
  await greenNFT.waitForDeployment();
  const greenNFTAddress = await greenNFT.getAddress();
  console.log("GreenNFTCollection deployed to:", greenNFTAddress);

  // ===================================================================
  // 3. Deploy CarbonCreditRegistry
  // ===================================================================
  console.log("\nDeploying CarbonCreditRegistry...");
  const CarbonCreditRegistry = await ethers.getContractFactory(
    "CarbonCreditRegistry"
  );
  const registry = await CarbonCreditRegistry.deploy(
    cctAddress,
    greenNFTAddress
  );
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("CarbonCreditRegistry deployed to:", registryAddress);

  // ===================================================================
  // 4. Grant roles to Registry
  // ===================================================================
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));

  console.log("\nGranting MINTER_ROLE on CCT to Registry...");
  const tx1 = await cct.grantRole(MINTER_ROLE, registryAddress);
  await tx1.wait();
  console.log("✓ CCT MINTER_ROLE granted");

  console.log("Granting MINTER_ROLE on GreenNFTCollection to Registry...");
  const tx2 = await greenNFT.grantRole(MINTER_ROLE, registryAddress);
  await tx2.wait();
  console.log("✓ GreenNFT MINTER_ROLE granted");

  // ===================================================================
  // 5. Deploy CarbonCreditMarketplace
  // ===================================================================
  console.log("\nDeploying CarbonCreditMarketplace...");
  const CarbonCreditMarketplace = await ethers.getContractFactory(
    "CarbonCreditMarketplace"
  );
  const marketplace = await CarbonCreditMarketplace.deploy(
    registryAddress,
    cctAddress,
    greenNFTAddress
  );
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log("CarbonCreditMarketplace deployed to:", marketplaceAddress);

  // ===================================================================
  // Final Summary
  // ===================================================================
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT SUCCESSFUL");
  console.log("=".repeat(60));
  console.log("CarbonCreditToken       :", cctAddress);
  console.log("GreenNFTCollection      :", greenNFTAddress);
  console.log("CarbonCreditRegistry    :", registryAddress);
  console.log("CarbonCreditMarketplace :", marketplaceAddress);
  console.log("Deployer                :", deployer.address);
  console.log(
    "Chain ID                :",
    (await ethers.provider.getNetwork()).chainId
  );
  console.log("=".repeat(60));

  // Save addresses to JSON file (useful for frontend)
  const fs = require("fs");
  const network = await ethers.provider.getNetwork();
  const block = await ethers.provider.getBlock("latest");

  const deploymentData = {
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    CarbonCreditToken: cctAddress,
    GreenNFTCollection: greenNFTAddress,
    CarbonCreditRegistry: registryAddress,
    CarbonCreditMarketplace: marketplaceAddress,
    blockNumber: block.number.toString(),
    timestamp: new Date().toISOString(),
  };

  const outputPath = "./deployments/deployment-" + Date.now() + ".json";
  fs.mkdirSync("./deployments", { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(deploymentData, null, 2));
  console.log(`\nDeployment info saved to: ${outputPath}`);

  // Optional: Print verification commands (for Etherscan, Polygonscan, etc.)
  console.log("\nVerification commands (run after indexing):");
  console.log(`npx hardhat verify --network <network> ${cctAddress}`);
  console.log(`npx hardhat verify --network <network> ${greenNFTAddress}`);
  console.log(
    `npx hardhat verify --network <network> ${registryAddress} "${cctAddress}" "${greenNFTAddress}"`
  );
  console.log(
    `npx hardhat verify --network <network> ${marketplaceAddress} "${registryAddress}" "${cctAddress}"`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
