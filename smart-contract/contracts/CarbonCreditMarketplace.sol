// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./CarbonCreditToken.sol";
import "./CarbonCreditRegistry.sol";
import "./GreenNFTCollection.sol";

contract CarbonCreditMarketplace {
    CarbonCreditToken public cct;
    CarbonCreditRegistry public registry;
    GreenNFTCollection public greenNFTCollection;

    // wei / ton
    uint256 public constant PRICE_PER_TON = 0.00005 ether;
    uint256 private constant ONE_ETHER = 1e18;

    struct BatchSale {
        address seller;
        uint256 claimId;
        uint256 totalWei; // total CCT (wei)
        uint256 availableWei; // remaining CCT (wei)
        bool active;
    }

    struct Purchase {
        uint256 batchTokenId;
        uint256 tonsWei;
        uint256 ethPaid;
        uint256 timestamp;
    }

    mapping(uint256 => BatchSale) public batchSales;
    uint256[] private activeBatchIds;

    mapping(address => Purchase[]) private purchaseHistory;

    // ================= EVENTS =================

    event BatchSaleOpened(
        uint256 indexed batchTokenId,
        uint256 claimId,
        uint256 totalWei,
        address seller
    );

    event BatchSaleCancelled(uint256 indexed batchTokenId);

    event CreditsPurchased(
        address indexed buyer,
        uint256 indexed batchTokenId,
        uint256 tonsWei,
        uint256 ethPaid,
        uint256 remainingWei
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

    // ================= SELL =================

    function openBatchSale(uint256 batchTokenId) external {
        require(
            greenNFTCollection.ownerOf(batchTokenId) == msg.sender,
            "Not batch owner"
        );
        require(!batchSales[batchTokenId].active, "Already on sale");

        uint256 claimId = registry.batchToClaimId(batchTokenId);
        require(claimId != 0, "Batch not found");

        CarbonCreditRegistry.Claim memory claim = registry.getClaim(claimId);
        require(
            claim.status == CarbonCreditRegistry.Status.Audited,
            "Not audited"
        );

        uint256 totalWei = claim.reductionTons;
        require(totalWei > 0, "Zero amount");

        // Escrow toàn bộ CCT (WEI)
        cct.transferFrom(msg.sender, address(this), totalWei);

        batchSales[batchTokenId] = BatchSale({
            seller: msg.sender,
            claimId: claimId,
            totalWei: totalWei,
            availableWei: totalWei,
            active: true
        });

        activeBatchIds.push(batchTokenId);
        registry.setClaimStatus(claimId, CarbonCreditRegistry.Status.OnSale);

        emit BatchSaleOpened(batchTokenId, claimId, totalWei, msg.sender);
    }

    function cancelBatchSale(uint256 batchTokenId) external {
        BatchSale storage sale = batchSales[batchTokenId];

        require(sale.active, "Not active");
        require(
            greenNFTCollection.ownerOf(batchTokenId) == msg.sender,
            "Not owner"
        );
        require(sale.availableWei == sale.totalWei, "Already partially sold");

        sale.active = false;
        _removeFromActiveList(batchTokenId);

        // trả lại toàn bộ CCT còn lại
        cct.transfer(sale.seller, sale.availableWei);

        sale.availableWei = 0;

        registry.setClaimStatus(
            sale.claimId,
            CarbonCreditRegistry.Status.Audited
        );

        emit BatchSaleCancelled(batchTokenId);
    }

    // ================= BUY =================

    function buyCredits(
        uint256 batchTokenId,
        uint256 tonsWei
    ) external payable {
        require(tonsWei > 0, "Zero amount");

        BatchSale storage sale = batchSales[batchTokenId];

        require(sale.active, "Not on sale");
        require(msg.sender != sale.seller, "Seller cannot buy");
        require(tonsWei <= sale.availableWei, "Insufficient supply");

        uint256 totalPrice = (tonsWei * PRICE_PER_TON) / ONE_ETHER;

        require(msg.value >= totalPrice, "Insufficient ETH");

        // ===== EFFECTS =====
        sale.availableWei -= tonsWei;

        // ===== INTERACTIONS =====
        cct.transfer(msg.sender, tonsWei);
        payable(sale.seller).transfer(totalPrice);

        if (msg.value > totalPrice) {
            payable(msg.sender).transfer(msg.value - totalPrice);
        }

        // ===== HISTORY =====
        purchaseHistory[msg.sender].push(
            Purchase({
                batchTokenId: batchTokenId,
                tonsWei: tonsWei,
                ethPaid: totalPrice,
                timestamp: block.timestamp
            })
        );

        // ===== FINALIZE =====
        if (sale.availableWei == 0) {
            sale.active = false;
            _removeFromActiveList(batchTokenId);
            registry.setClaimStatus(
                sale.claimId,
                CarbonCreditRegistry.Status.Sold
            );
            emit BatchFullySold(batchTokenId, sale.claimId);
        }

        emit CreditsPurchased(
            msg.sender,
            batchTokenId,
            tonsWei,
            totalPrice,
            sale.availableWei
        );
    }

    // ================= GETTERS =================

    function getActiveBatchSales() external view returns (uint256[] memory) {
        return activeBatchIds;
    }

    function getBatchSale(
        uint256 batchTokenId
    )
        external
        view
        returns (
            address seller,
            uint256 totalWei,
            uint256 availableWei,
            bool active
        )
    {
        BatchSale memory sale = batchSales[batchTokenId];
        return (sale.seller, sale.totalWei, sale.availableWei, sale.active);
    }

    function getPurchaseHistory(
        address buyer
    ) external view returns (Purchase[] memory) {
        return purchaseHistory[buyer];
    }

    // ================= INTERNAL =================

    function _removeFromActiveList(uint256 batchTokenId) internal {
        uint256 len = activeBatchIds.length;
        for (uint256 i = 0; i < len; i++) {
            if (activeBatchIds[i] == batchTokenId) {
                activeBatchIds[i] = activeBatchIds[len - 1];
                activeBatchIds.pop();
                break;
            }
        }
    }
}
