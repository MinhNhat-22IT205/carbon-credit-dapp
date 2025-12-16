// scripts/deploy.js
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("🚀 Bắt đầu deploy hệ thống Carbon Credit...");
  console.log("Deployer:", deployer.address);
  console.log(
    "Balance:",
    ethers.formatEther(await deployer.provider.getBalance(deployer.address)),
    "ETH"
  );
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId);
  console.log("=".repeat(80));

  // ===================================================================
  // 1. Deploy RetirementCertificate (nếu bạn muốn có retire)
  // ===================================================================
  console.log("\n1. Deploying RetirementCertificate...");
  const RetirementCertificate = await ethers.getContractFactory(
    "RetirementCertificate"
  );
  const retirementCert = await RetirementCertificate.deploy();
  await retirementCert.waitForDeployment();
  const retirementCertAddress = await retirementCert.getAddress();
  console.log("RetirementCertificate deployed to:", retirementCertAddress);

  // ===================================================================
  // 2. Deploy CarbonCreditToken (CCT) - truyền RetirementCertificate
  // ===================================================================
  console.log("\n2. Deploying CarbonCreditToken...");
  const CarbonCreditToken = await ethers.getContractFactory(
    "CarbonCreditToken"
  );
  const cct = await CarbonCreditToken.deploy(retirementCertAddress); // Truyền address
  await cct.waitForDeployment();
  const cctAddress = await cct.getAddress();
  console.log("CarbonCreditToken deployed to:", cctAddress);

  // ===================================================================
  // 3. Deploy GreenNFTCollection
  // ===================================================================
  console.log("\n3. Deploying GreenNFTCollection...");
  const GreenNFTCollection = await ethers.getContractFactory(
    "GreenNFTCollection"
  );
  const greenNFT = await GreenNFTCollection.deploy();
  await greenNFT.waitForDeployment();
  const greenNFTAddress = await greenNFT.getAddress();
  console.log("GreenNFTCollection deployed to:", greenNFTAddress);

  // ===================================================================
  // 4. Deploy CarbonCreditRegistry
  // ===================================================================
  console.log("\n4. Deploying CarbonCreditRegistry...");
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
  // 5. Deploy CarbonCreditMarketplace
  // ===================================================================
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

  // ===================================================================
  // 6. Grant roles
  // ===================================================================
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));

  console.log("\n6. Granting roles...");

  // Grant MINTER_ROLE cho Registry trên CCT
  let tx = await cct.grantRole(MINTER_ROLE, registryAddress);
  await tx.wait();
  console.log("✓ CCT: MINTER_ROLE granted to Registry");

  // Grant MINTER_ROLE cho Registry trên GreenNFT
  tx = await greenNFT.grantRole(MINTER_ROLE, registryAddress);
  await tx.wait();
  console.log("✓ GreenNFT: MINTER_ROLE granted to Registry");

  // Grant MINTER_ROLE cho CCT trên RetirementCertificate
  tx = await retirementCert.grantRole(MINTER_ROLE, cctAddress);
  await tx.wait();
  console.log("✓ RetirementCertificate: MINTER_ROLE granted to CCT");

  // (Tùy chọn) Set marketplace address vào Registry nếu có hàm setMarketplace
  if ((await registry.marketplace()) === ethers.ZeroAddress) {
    tx = await registry.setMarketplace(marketplaceAddress);
    await tx.wait();
    console.log("✓ Registry: Marketplace address set");
  }

  // ===================================================================
  // 7. Final Summary
  // ===================================================================
  console.log("\n" + "=".repeat(80));
  console.log("               🎉 DEPLOYMENT THÀNH CÔNG! 🎉");
  console.log("=".repeat(80));
  console.log("CarbonCreditToken       :", cctAddress);
  console.log("RetirementCertificate   :", retirementCertAddress);
  console.log("GreenNFTCollection      :", greenNFTAddress);
  console.log("CarbonCreditRegistry     :", registryAddress);
  console.log("CarbonCreditMarketplace  :", marketplaceAddress);
  console.log("Deployer                 :", deployer.address);
  console.log(
    "Chain ID                 :",
    (await ethers.provider.getNetwork()).chainId
  );
  console.log("=".repeat(80));

  // ===================================================================
  // 8. Save deployment info
  // ===================================================================
  const fs = require("fs");
  const network = await ethers.provider.getNetwork();

  const deploymentData = {
    network: network.name,
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      RetirementCertificate: retirementCertAddress,
      CarbonCreditToken: cctAddress,
      GreenNFTCollection: greenNFTAddress,
      CarbonCreditRegistry: registryAddress,
      CarbonCreditMarketplace: marketplaceAddress,
    },
  };

  const deploymentsDir = "./deployments";
  fs.mkdirSync(deploymentsDir, { recursive: true });
  const fileName = `deployment-${network.name}-${Date.now()}.json`;
  const filePath = `${deploymentsDir}/${fileName}`;
  fs.writeFileSync(filePath, JSON.stringify(deploymentData, null, 2));

  console.log(`\n📄 Deployment info saved to: ${filePath}`);

  // ===================================================================
  // 9. Verification commands (Hardhat)
  // ===================================================================
  console.log("\n🔍 Verification commands (run manually):");
  console.log(
    `npx hardhat verify --network ${network.name} ${retirementCertAddress}`
  );
  console.log(
    `npx hardhat verify --network ${network.name} ${cctAddress} "${retirementCertAddress}"`
  );
  console.log(
    `npx hardhat verify --network ${network.name} ${greenNFTAddress}`
  );
  console.log(
    `npx hardhat verify --network ${network.name} ${registryAddress} "${cctAddress}" "${greenNFTAddress}"`
  );
  console.log(
    `npx hardhat verify --network ${network.name} ${marketplaceAddress} "${registryAddress}" "${cctAddress}" "${greenNFTAddress}"`
  );

  console.log("\n✅ Hoàn tất! Hệ thống đã sẵn sàng.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
