// scripts/deploy.js
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log(
    "Account balance:",
    ethers.formatEther(await deployer.provider.getBalance(deployer.address)),
    "ETH"
  );

  // 1. Deploy CarbonCreditToken
  console.log("\n1. Deploying CarbonCreditToken...");
  const CarbonCreditToken = await ethers.getContractFactory(
    "CarbonCreditToken"
  );
  const cct = await CarbonCreditToken.deploy();
  await cct.waitForDeployment();
  const cctAddress = await cct.getAddress();
  console.log("CarbonCreditToken deployed to:", cctAddress);

  // 2. Deploy GreenNFTCollection
  console.log("\n2. Deploying GreenNFTCollection...");
  const GreenNFTCollection = await ethers.getContractFactory(
    "GreenNFTCollection"
  );
  const greenNFT = await GreenNFTCollection.deploy();
  await greenNFT.waitForDeployment();
  const greenNFTAddress = await greenNFT.getAddress();
  console.log("GreenNFTCollection deployed to:", greenNFTAddress);

  // 3. Deploy CarbonCreditRegistry
  console.log("\n3. Deploying CarbonCreditRegistry...");
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

  // 4. Grant MINTER_ROLE cho Registry
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));

  console.log("\nGranting MINTER_ROLE on CCT to Registry...");
  let tx = await cct.grantRole(MINTER_ROLE, registryAddress);
  await tx.wait();
  console.log("✓ CCT MINTER_ROLE granted");

  console.log("Granting MINTER_ROLE on GreenNFT to Registry...");
  tx = await greenNFT.grantRole(MINTER_ROLE, registryAddress);
  await tx.wait();
  console.log("✓ GreenNFT MINTER_ROLE granted");

  // 5. Deploy CarbonCreditMarketplace (phiên bản bán toàn bộ batch)
  console.log("\n5. Deploying CarbonCreditMarketplace...");
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

  // 6. *** BƯỚC MỚI BẮT BUỘC *** Set Marketplace address vào Registry
  console.log("\n6. Setting Marketplace address in Registry...");
  tx = await registry.setMarketplace(marketplaceAddress);
  await tx.wait();
  console.log(
    "✓ Marketplace authorized to update claim status (OnSale / Sold)"
  );

  // ===================================================================
  // Final Summary
  // ===================================================================
  console.log("\n" + "=".repeat(70));
  console.log("                  DEPLOYMENT SUCCESSFUL");
  console.log("=".repeat(70));
  console.log("CarbonCreditToken       :", cctAddress);
  console.log("GreenNFTCollection     :", greenNFTAddress);
  console.log("CarbonCreditRegistry    :", registryAddress);
  console.log("CarbonCreditMarketplace :", marketplaceAddress);
  console.log("Deployer                :", deployer.address);
  console.log(
    "Chain ID                :",
    (await ethers.provider.getNetwork()).chainId
  );
  console.log("=".repeat(70));

  // Save deployment info
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

  const outputPath = `./deployments/deployment-${Date.now()}.json`;
  fs.mkdirSync("./deployments", { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(deploymentData, null, 2));
  console.log(`\nDeployment info saved to: ${outputPath}`);

  // Verification commands
  console.log("\nVerification commands:");
  console.log(`npx hardhat verify --network <network> ${cctAddress}`);
  console.log(`npx hardhat verify --network <network> ${greenNFTAddress}`);
  console.log(
    `npx hardhat verify --network <network> ${registryAddress} "${cctAddress}" "${greenNFTAddress}"`
  );
  console.log(
    `npx hardhat verify --network <network> ${marketplaceAddress} "${registryAddress}" "${cctAddress}" "${greenNFTAddress}"`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
