// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RetirementCertificate.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * 1. CarbonCreditToken (CCT) - ERC20 đại diện cho 1 tấn CO2 đã được chứng nhận
 */
contract CarbonCreditToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    RetirementCertificate public retirementCertificate;

    event TokensRetired(
        address indexed retire,
        uint256 tons,
        uint256 certificateId,
        string purpose,
        uint256 timestamp
    );

    constructor(
        RetirementCertificate _retirementCertificate
    ) ERC20("Carbon Credit Token", "CCT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        retirementCertificate = _retirementCertificate;

        // Grant MINTER_ROLE cho CCT để tự mint certificate
        _grantRole(MINTER_ROLE, address(this));
    }

    function mint(address to, uint256 tons) external onlyRole(MINTER_ROLE) {
        _mint(to, tons * 1e18); // 1 CCT = 1 tấn CO2
    }

    /**
     * @dev Retire (burn) CCT và mint Retirement Certificate NFT
     * @param tons Số tấn muốn retire
     * @param purpose Mục đích retire (ví dụ: "2025 Carbon Neutral", "Product Offset")
     * @param certificateURI IPFS link đến metadata certificate (JSON + image)
     */
    function retire(
        uint256 tons,
        string memory purpose,
        string memory certificateURI
    ) external returns (uint256 certificateId) {
        require(tons > 0, "Zero tons");
        uint256 amount = tons * 1e18;

        _burn(msg.sender, amount);

        certificateId = retirementCertificate.mintCertificate(
            msg.sender,
            certificateURI
        );

        emit TokensRetired(
            msg.sender,
            tons,
            certificateId,
            purpose,
            block.timestamp
        );
        return certificateId;
    }
}
