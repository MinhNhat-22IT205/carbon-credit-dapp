// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./CarbonCreditToken.sol";
import "./CarbonCreditRegistry.sol";
import "./GreenNFTCollection.sol";

contract CarbonCreditMarketplace {
    CarbonCreditToken public cct;
    CarbonCreditRegistry public registry;
    GreenNFTCollection public greenNFTCollection;

    uint256 public constant PRICE_PER_TON = 0.00005 ether;

    struct BatchSale {
        address seller;
        uint256 claimId;
        uint256 totalTons; // Tổng số tấn ban đầu (= reductionTons)
        uint256 availableTons; // Số tấn còn lại để bán
        bool active;
    }

    mapping(uint256 => BatchSale) public batchSales;
    uint256[] private activeBatchIds; // Danh sách batch đang có hàng để bán

    event BatchSaleOpened(
        uint256 indexed batchTokenId,
        uint256 claimId,
        uint256 totalTons,
        address seller
    );
    event BatchSaleCancelled(uint256 indexed batchTokenId);
    event CreditsPurchased(
        address indexed buyer,
        uint256 indexed batchTokenId,
        uint256 tons,
        uint256 ethPaid,
        uint256 remainingTons
    );
    event BatchFullySold(uint256 indexed batchTokenId, uint256 claimId);

    constructor(
        CarbonCreditRegistry _registry,
        CarbonCreditToken _cct,
        GreenNFTCollection _greenNFTCollection
    ) {
        registry = _registry;
        cct = _cct;
        greenNFTCollection = _greenNFTCollection;
    }

    // Mở bán TOÀN BỘ batch một lần
    function openBatchSale(uint256 batchTokenId) external {
        require(
            greenNFTCollection.ownerOf(batchTokenId) == msg.sender,
            "Not batch owner"
        );
        require(!batchSales[batchTokenId].active, "Already on sale");

        uint256 claimId = registry.batchToClaimId(batchTokenId); // Giả sử đã thêm mapping này
        require(claimId != 0, "Batch not found");

        CarbonCreditRegistry.Claim memory claim = registry.getClaim(claimId);
        require(claim.batchTokenId == batchTokenId, "Invalid batch");
        require(
            claim.status == CarbonCreditRegistry.Status.Audited,
            "Not audited"
        );

        uint256 tons = claim.reductionTons;
        require(tons > 0, "Zero tons");

        // Escrow TOÀN BỘ CCT vào marketplace
        cct.transferFrom(msg.sender, address(this), tons * 1e18);

        batchSales[batchTokenId] = BatchSale({
            seller: msg.sender,
            claimId: claimId,
            totalTons: tons,
            availableTons: tons,
            active: true
        });

        activeBatchIds.push(batchTokenId);

        // Cập nhật trạng thái thành OnSale
        registry.setClaimStatus(claimId, CarbonCreditRegistry.Status.OnSale);

        emit BatchSaleOpened(batchTokenId, claimId, tons, msg.sender);
    }

    // Hủy bán → trả lại toàn bộ CCT còn lại
    function cancelBatchSale(uint256 batchTokenId) external {
        BatchSale storage sale = batchSales[batchTokenId];
        require(sale.active, "Not active");
        require(
            greenNFTCollection.ownerOf(batchTokenId) == msg.sender,
            "Not owner"
        );
        require(
            sale.availableTons == sale.totalTons,
            "Cannot cancel after partial sale"
        );

        uint256 remaining = sale.availableTons;

        sale.active = false;
        sale.availableTons = 0;
        _removeFromActiveList(batchTokenId);

        if (remaining > 0) {
            cct.transfer(sale.seller, remaining * 1e18);
        }

        // Quay lại Audited nếu chưa bán hết, hoặc giữ OnSale nếu muốn
        registry.setClaimStatus(
            sale.claimId,
            CarbonCreditRegistry.Status.Audited
        );

        emit BatchSaleCancelled(batchTokenId);
    }

    // Mua MỘT PHẦN (tons <= availableTons)
    function buyCredits(uint256 batchTokenId, uint256 tons) external payable {
        require(tons > 0, "Zero tons");

        BatchSale storage sale = batchSales[batchTokenId];
        require(sale.active, "Not on sale");
        require(msg.sender != sale.seller, "Seller cannot buy own batch");
        require(tons <= sale.availableTons, "Not enough available");

        uint256 totalPrice = tons * PRICE_PER_TON;
        require(msg.value >= totalPrice, "Insufficient ETH");

        // Update state trước (Checks-Effects-Interactions)
        sale.availableTons -= tons;

        bool fullySold = sale.availableTons == 0;
        if (fullySold) {
            sale.active = false;
            _removeFromActiveList(batchTokenId);
            registry.setClaimStatus(
                sale.claimId,
                CarbonCreditRegistry.Status.Sold
            );
            emit BatchFullySold(batchTokenId, sale.claimId);
        }

        // Chuyển CCT cho buyer
        cct.transfer(msg.sender, tons * 1e18);

        // Chuyển ETH cho seller
        payable(sale.seller).transfer(totalPrice);
        if (msg.value > totalPrice) {
            payable(msg.sender).transfer(msg.value - totalPrice);
        }

        emit CreditsPurchased(
            msg.sender,
            batchTokenId,
            tons,
            totalPrice,
            sale.availableTons
        );
    }

    // === GET FUNCTIONS CHO FRONTEND ===

    // 1. Danh sách batch đang bán
    function getActiveBatchSales() external view returns (uint256[] memory) {
        return activeBatchIds;
    }

    // 2. Thông tin sale cơ bản (chỉ những gì cần thiết trên chain)
    function getBatchSale(
        uint256 batchTokenId
    )
        external
        view
        returns (
            address seller,
            uint256 totalTons,
            uint256 availableTons,
            bool active
        )
    {
        BatchSale memory sale = batchSales[batchTokenId];
        return (sale.seller, sale.totalTons, sale.availableTons, sale.active);
    }

    // 3. Lấy nhiều sale cùng lúc (nếu frontend muốn batch call)
    function getMultipleBatchSales(
        uint256[] calldata batchTokenIds
    ) external view returns (BatchSale[] memory sales) {
        sales = new BatchSale[](batchTokenIds.length);
        for (uint256 i = 0; i < batchTokenIds.length; i++) {
            sales[i] = batchSales[batchTokenIds[i]];
        }
    }

    // === INTERNAL ===
    function _removeFromActiveList(uint256 batchTokenId) internal {
        for (uint256 i = 0; i < activeBatchIds.length; i++) {
            if (activeBatchIds[i] == batchTokenId) {
                activeBatchIds[i] = activeBatchIds[activeBatchIds.length - 1];
                activeBatchIds.pop();
                break;
            }
        }
    }
}
