// 4. CarbonCreditMarketplace - Mua bán Carbon Credit bằng ETH

import "./CarbonCreditToken.sol";
import "./CarbonCreditRegistry.sol";

contract CarbonCreditMarketplace {
    CarbonCreditToken public cct;
    CarbonCreditRegistry public registry;
    GreenNFTCollection public greenNFTCollection;

    uint256 public constant PRICE_PER_TON = 0.01 ether; // Có thể điều chỉnh sau

    struct Sale {
        address seller;
        uint256 availableTons;
        bool active;
    }

    // Bán theo batch NFT (mỗi batch có thể bán một phần CCT)
    mapping(uint256 => Sale) public sales; // batchTokenId => Sale

    event SaleOpened(
        uint256 indexed batchTokenId,
        uint256 tons,
        address seller
    );
    event SaleCancelled(uint256 indexed batchTokenId);
    event CreditsPurchased(
        address indexed buyer,
        uint256 indexed batchTokenId,
        uint256 tons,
        uint256 ethPaid
    );

    constructor(
        CarbonCreditRegistry _registry,
        CarbonCreditToken _cct,
        GreenNFTCollection _greenNFTCollection // Inject trực tiếp
    ) {
        registry = _registry;
        cct = _cct;
        greenNFTCollection = _greenNFTCollection;
    }

    // Project owner mở bán một phần hoặc toàn bộ CCT của batch
    function openSale(uint256 batchTokenId, uint256 tonsForSale) external {
        // Kiểm tra owner của NFT batch
        require(
            greenNFTCollection.ownerOf(batchTokenId) == msg.sender,
            "Not batch owner"
        );

        require(tonsForSale > 0, "Zero tons");
        require(!sales[batchTokenId].active, "Already on sale");

        cct.transferFrom(msg.sender, address(this), tonsForSale * 1e18);

        sales[batchTokenId].seller = msg.sender;
        sales[batchTokenId].availableTons = tonsForSale;
        sales[batchTokenId].active = true;

        emit SaleOpened(batchTokenId, tonsForSale, msg.sender);
    }

    function cancelSale(uint256 batchTokenId) external {
        Sale storage sale = sales[batchTokenId];
        require(sale.active && sale.seller == msg.sender, "Invalid sale");

        sale.active = false;
        cct.transfer(sale.seller, sale.availableTons * 1e18);

        emit SaleCancelled(batchTokenId);
    }

    function buyCredits(uint256 batchTokenId, uint256 tons) external payable {
        Sale storage sale = sales[batchTokenId];
        require(sale.active, "Not active");
        require(tons <= sale.availableTons, "Not enough");

        uint256 totalPrice = tons * PRICE_PER_TON;
        require(msg.value >= totalPrice, "Insufficient ETH");

        // --- UPDATE STATE TRƯỚC ---
        sale.availableTons -= tons;
        if (sale.availableTons == 0) sale.active = false;

        cct.transfer(msg.sender, tons * 1e18);

        // --- GỬI ETH SAU ---
        payable(sale.seller).transfer(totalPrice);
        if (msg.value > totalPrice) {
            payable(msg.sender).transfer(msg.value - totalPrice);
        }

        emit CreditsPurchased(msg.sender, batchTokenId, tons, totalPrice);
    }

    function getSale(uint256 batchTokenId) external view returns (Sale memory) {
        return sales[batchTokenId];
    }
}
