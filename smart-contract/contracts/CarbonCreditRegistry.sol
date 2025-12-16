// 3. CarbonCreditRegistry - Quản lý Project, Claim, Audit và Mint NFT + CCT
import "./CarbonCreditToken.sol";
import "./GreenNFTCollection.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";

contract CarbonCreditRegistry is AccessControlEnumerable {
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");
    address public marketplace;

    CarbonCreditToken public cct;
    GreenNFTCollection public greenNFTCollection; // Single collection

    uint256 public projectIdCounter;
    uint256 public claimIdCounter;

    enum Status {
        Pending,
        Audited,
        Rejected,
        OnSale,
        Sold,
        Cancelled
    }

    struct Project {
        address owner;
        string name;
        uint256 baselineEmissions;
    }

    struct Claim {
        uint256 projectId;
        uint256 reductionTons;
        uint256 periodStart;
        uint256 periodEnd;
        string evidenceIPFS;
        Status status;
        uint256 batchTokenId; // NFT tokenId nếu đã audit
    }

    mapping(uint256 => Project) public projects;
    mapping(uint256 => Claim) public claims;
    mapping(uint256 => uint256) public batchToClaimId;

    event ProjectRegistered(
        uint256 indexed projectId,
        address owner,
        string name
    );
    event ClaimSubmitted(
        uint256 indexed claimId,
        uint256 projectId,
        uint256 tons
    );
    event ClaimAudited(
        uint256 indexed claimId,
        uint256 tons,
        uint256 batchTokenId
    );
    event AuditorAdded(address indexed auditor);
    event AuditorRemoved(address indexed auditor);
    event ClaimRejected(uint256 indexed claimId);

    constructor(
        CarbonCreditToken _cct,
        GreenNFTCollection _greenNFTCollection
    ) {
        cct = _cct;
        greenNFTCollection = _greenNFTCollection;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setRoleAdmin(AUDITOR_ROLE, DEFAULT_ADMIN_ROLE); // Admin quản lý auditor role
    }

    function setMarketplace(
        address _marketplace
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        marketplace = _marketplace;
    }

    modifier onlyMarketplace() {
        require(msg.sender == marketplace, "Not marketplace");
        _;
    }

    function setClaimStatus(
        uint256 claimId,
        Status newStatus
    ) external onlyMarketplace {
        claims[claimId].status = newStatus;
    }

    // ==================== ROLE MANAGEMENT ====================

    /**
     * @dev Thêm một auditor mới - chỉ admin gọi được
     */
    function addAuditor(address auditor) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(AUDITOR_ROLE, auditor);
        emit AuditorAdded(auditor);
    }

    /**
     * @dev Thu hồi quyền auditor - chỉ admin gọi được
     */
    function removeAuditor(
        address auditor
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(AUDITOR_ROLE, auditor);
        emit AuditorRemoved(auditor);
    }

    /**
     * @dev Kiểm tra một address có phải auditor không
     */
    function isAuditor(address account) external view returns (bool) {
        return hasRole(AUDITOR_ROLE, account);
    }

    /**
     * @dev Lấy danh sách tất cả auditor hiện tại
     * @notice Cảnh báo: danh sách có thể dài → chỉ dùng cho frontend admin nhỏ
     */
    function getAllAuditors() external view returns (address[] memory) {
        uint256 count = getRoleMemberCount(AUDITOR_ROLE);
        address[] memory auditors = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            auditors[i] = getRoleMember(AUDITOR_ROLE, i);
        }
        return auditors;
    }

    /**
     * @dev Lấy số lượng auditor hiện tại
     */
    function getAuditorCount() external view returns (uint256) {
        return getRoleMemberCount(AUDITOR_ROLE);
    }

    function registerProject(
        string calldata name,
        uint256 baselineEmissions
    ) external returns (uint256) {
        uint256 projectId = ++projectIdCounter;
        projects[projectId] = Project(msg.sender, name, baselineEmissions);
        emit ProjectRegistered(projectId, msg.sender, name);
        return projectId;
    }

    function submitClaim(
        uint256 projectId,
        uint256 reductionTons,
        uint256 periodStart,
        uint256 periodEnd,
        string calldata evidenceIPFS
    ) external returns (uint256) {
        require(projects[projectId].owner == msg.sender, "Not project owner");
        uint256 claimId = ++claimIdCounter;
        claims[claimId] = Claim({
            projectId: projectId,
            reductionTons: reductionTons,
            periodStart: periodStart,
            periodEnd: periodEnd,
            evidenceIPFS: evidenceIPFS,
            status: Status.Pending,
            batchTokenId: 0
        });
        emit ClaimSubmitted(claimId, projectId, reductionTons);
        return claimId;
    }

    function auditAndIssue(
        uint256 claimId,
        string calldata auditReportIPFS // IPFS hash hoặc full URL: ipfs://...
    ) external onlyRole(AUDITOR_ROLE) returns (uint256 batchTokenId) {
        Claim storage claim = claims[claimId];
        require(claim.status == Status.Pending, "Invalid status");

        claim.status = Status.Audited;

        // Mint một NFT mới trong collection chung
        string memory tokenURI = string(
            abi.encodePacked("ipfs://", auditReportIPFS)
        );
        batchTokenId = greenNFTCollection.mintBatchCertificate(
            projects[claim.projectId].owner,
            tokenURI
        );

        claim.batchTokenId = batchTokenId;
        batchToClaimId[batchTokenId] = claimId;

        // Mint CCT = số tấn giảm được
        cct.mint(projects[claim.projectId].owner, claim.reductionTons);

        emit ClaimAudited(claimId, claim.reductionTons, batchTokenId);
        return batchTokenId;
    }

    function rejectClaim(uint256 claimId) external onlyRole(AUDITOR_ROLE) {
        Claim storage claim = claims[claimId];
        require(claim.status == Status.Pending, "Not pending");

        claim.status = Status.Rejected;

        emit ClaimRejected(claimId);
    }

    // Getters...
    /**
     * @dev Lấy danh sách tất cả project ID mà user sở hữu
     */
    function getProjectsByOwner(
        address owner
    ) external view returns (uint256[] memory) {
        uint256 count = 0;
        // Đếm trước
        for (uint256 i = 1; i <= projectIdCounter; i++) {
            if (projects[i].owner == owner) count++;
        }

        uint256[] memory ownerProjectIds = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= projectIdCounter; i++) {
            if (projects[i].owner == owner) {
                ownerProjectIds[index] = i;
                index++;
            }
        }
        return ownerProjectIds;
    }

    /**
     * @dev Lấy danh sách tất cả claim ID của một project
     */
    function getClaimsByProject(
        uint256 projectId
    ) external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= claimIdCounter; i++) {
            if (claims[i].projectId == projectId) count++;
        }

        uint256[] memory projectClaimIds = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= claimIdCounter; i++) {
            if (claims[i].projectId == projectId) {
                projectClaimIds[index] = i;
                index++;
            }
        }
        return projectClaimIds;
    }

    /**
     * @dev Lấy danh sách tất cả claim đang chờ audit (Pending)
     */
    function getPendingClaims() external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= claimIdCounter; i++) {
            if (claims[i].status == Status.Pending) count++;
        }

        uint256[] memory pendingIds = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= claimIdCounter; i++) {
            if (claims[i].status == Status.Pending) {
                pendingIds[index] = i;
                index++;
            }
        }
        return pendingIds;
    }

    /**
     * @dev Lấy danh sách tất cả claim đã được audit (của một user nếu cần)
     */
    function getAuditedClaimsByOwner(
        address owner
    ) external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= claimIdCounter; i++) {
            if (claims[i].status == Status.Audited) {
                uint256 pid = claims[i].projectId;
                if (projects[pid].owner == owner) count++;
            }
        }

        uint256[] memory auditedIds = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= claimIdCounter; i++) {
            if (claims[i].status == Status.Audited) {
                uint256 pid = claims[i].projectId;
                if (projects[pid].owner == owner) {
                    auditedIds[index] = i;
                    index++;
                }
            }
        }
        return auditedIds;
    }

    function getProject(
        uint256 projectId
    ) external view returns (Project memory) {
        return projects[projectId];
    }

    function getClaim(uint256 claimId) external view returns (Claim memory) {
        return claims[claimId];
    }
}
