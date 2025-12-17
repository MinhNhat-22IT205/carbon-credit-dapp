## Hướng dẫn setup & chạy dự án `carbon-credit-blockchain`

---

## 1. Chuẩn bị môi trường

- **Hệ điều hành**: Windows / macOS / Linux đều được.
- **Node.js**: khuyến nghị **`v18.x` trở lên**

  - Kiểm tra version:

    ```bash
    node -v
    npm -v
    ```

- **Trình quản lý package**: dùng `npm` (có sẵn khi cài Node).
- **Ví Web3**: **MetaMask** cài trên trình duyệt.
- **Network blockchain**:
  - Có thể dùng:
    - **Hardhat local node** (dev local, không cần testnet), hoặc
    - **Sepolia testnet** (cần RPC + private key ví test có ETH test).

> Nếu bạn chỉ muốn chạy nhanh để demo trên máy cá nhân, nên dùng **local Hardhat node** trước cho dễ.

---

## 2. Clone & mở dự án

1. Mở terminal (cmd/PowerShell trên Windows, Terminal trên macOS/Linux).
2. Chạy:

   ```bash
   git clone <REPO_URL> carbon-credit-blockchain
   cd carbon-credit-blockchain
   ```

   - Thay `<REPO_URL>` bằng URL repo thật trên GitHub/GitLab.

3. Cấu trúc chính của repo:
   - `smart-contract/`: code smart contract (Hardhat).
   - `frontend/`: app React (Vite) giao tiếp với smart contract.
   - `backend/`: hiện trống (có thể làm API sau).

---

## 3. Setup & chạy smart-contract (Hardhat)

Thư mục smart contract: `smart-contract/`

### 3.1. Cài dependencies

Từ thư mục root của repo:

```bash
cd smart-contract
npm install
```

Đợi cài xong rồi chuyển sang bước tiếp theo.

---

### 3.2. Cấu hình môi trường cho Hardhat

#### 3.2.1. Nếu chạy **local Hardhat node**

1. Tạo file `.env` trong thư mục `smart-contract/` (nếu chưa có):

   ```bash
   cd smart-contract
   touch .env
   ```

2. Thêm nội dung (ví dụ):

   ```bash
   HARDHAT_NETWORK=localhost
   ```

3. Chạy Hardhat node:

   ```bash
   npx hardhat node
   ```

   - Terminal này sẽ **chạy liên tục**, đừng tắt.
   - Hardhat node sẽ tạo sẵn nhiều account + private key để bạn dùng.

4. Mở **cửa sổ terminal mới**, vẫn trong `smart-contract/`:

   ```bash
   npx hardhat run scripts/deploy.js --network localhost
   ```

   - Lệnh này sẽ deploy tất cả contract lên local node.
   - Sau khi deploy xong, hãy ghi lại **địa chỉ contract** in ra trong log hoặc trong thư mục `deployments/` (nếu script có lưu).

#### 3.2.2. Nếu deploy lên **Sepolia testnet** (hiện đang dùng)

1. Lấy RPC URL (ví dụ từ Infura/Alchemy hay https://developer.metamask.io/):
   - Ví dụ: `https://sepolia.infura.io/v3/<YOUR_INFURA_KEY>`
2. Chuẩn bị ví test:
   - Lấy **private key** của ví MetaMask (chỉ dùng ví test!).
   - Đảm bảo ví có ETH test (có thể xin từ faucet vd: https://cloud.google.com/application/web3/faucet/ethereum/sepolia).
3. Tạo file `.env` trong `smart-contract/`:

   ```bash
   cd smart-contract
   touch .env
   ```

4. Thêm nội dung (ví dụ):

   ```bash
   SEPOLIA_RPC_URL="https://sepolia.infura.io/v3/<YOUR_INFURA_KEY>"
   PRIVATE_KEY="<PRIVATE_KEY_VI_TEST>"
   ```

5. Deploy contracts lên testnet:

   ```bash
   npx hardhat run scripts/deploy.js --network sepolia
   ```

   - Đợi deploy xong, copy lại **địa chỉ các contract** từ log hoặc file trong `deployments/`.

---

## 4. Setup & chạy Frontend (Vite + React)

Thư mục frontend: `frontend/`

### 4.1. Cài dependencies

Từ thư mục root của repo:

```bash
cd frontend
npm install
```

---

### 4.2. Cấu hình địa chỉ contract

1. Tìm file:

   - `frontend/src/contracts/addresses.ts`

2. Mở file và cập nhật theo địa chỉ bạn vừa deploy được:

```ts
export const CONTRACT_ADDRESSES = {
  CCT: "<Địa chỉ CarbonCreditToken>",
  // Thêm các contract khác nếu cần:
  // MARKETPLACE: "<Địa chỉ CarbonCreditMarketplace>",
  // REGISTRY: "<Địa chỉ CarbonCreditRegistry>",
  // GREEN_NFT_COLLECTION: "<Địa chỉ GreenNFTCollection>",
  // RETIREMENT_CERTIFICATE: "<Địa chỉ RetirementCertificate>",
};
```

- Nếu deploy local (`localhost`), địa chỉ này là địa chỉ trên Hardhat node.
- Nếu deploy Sepolia, địa chỉ phải **trùng network** với ví MetaMask đang kết nối.

---

### 4.3. Copy ABI từ smart-contract sang frontend (**bắt buộc**)

Sau khi deploy các smart contract, Hardhat sẽ tạo ra file ABI nằm trong thư mục `artifacts/`.

**Vị trí ABI mỗi contract:**

```
smart-contract/artifacts/contracts/<ContractName>.sol/<ContractName>.json
```

**Các bước copy ABI:**

1. Tạo thư mục lưu ABI cho frontend nếu chưa có:

   ```bash
   mkdir -p frontend/src/contracts/abi/
   ```

2. Copy từng file ABI về frontend. Ví dụ với `CarbonCreditToken`:

   ```bash
   cp smart-contract/artifacts/contracts/CarbonCreditToken.sol/CarbonCreditToken.json \
      frontend/src/contracts/abi/
   ```

   Làm tương tự để copy các ABI khác nếu frontend sử dụng thêm contract gì (vd: Marketplace, Registry...).

3. Sau khi copy xong, kiểm tra lại cấu trúc:

   ```
   frontend/src/contracts/
   ├─ abi/
   │  ├─ CarbonCreditToken.json
   │  └─ <ABI khác nếu có>
   ├─ addresses.ts
   ```

Chú ý: Nếu smart contract code thay đổi & bạn redeploy, hãy nhớ **copy lại ABI mới nhất** vào frontend!

---

## 5. Kết nối ví & phân quyền người dùng

- Mở frontend trong trình duyệt.
- Bấm nút **Connect Wallet** (RainbowKit).
- Chọn ví **MetaMask** và đảm bảo:
  - Nếu dùng local Hardhat: thêm network `localhost:8545` vào MetaMask (RPC `http://127.0.0.1:8545`).
  - Nếu dùng Sepolia: chọn mạng **Sepolia** trong MetaMask.

### 5.1. Các loại vai trò (role)

- **Admin**:
  - Thường là địa chỉ deployer (địa chỉ dùng để deploy contract).
  - Có quyền gán thêm các role khác.
- **Auditor**:
  - Được admin thêm thông qua trang quản trị (ví dụ `/admin/add-auditor`).
- **Project Owner**:
  - Bất kỳ địa chỉ ví bình thường không phải admin/auditor.

---
