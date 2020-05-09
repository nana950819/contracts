pragma solidity 0.5.17;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/upgrades/contracts/upgradeability/ProxyFactory.sol";
import "../access/Managers.sol";
import "../validators/ValidatorsRegistry.sol";
import "./Wallet.sol";
import "./Withdrawals.sol";

/**
 * @title WalletsRegistry
 * WalletsRegistry creates and assigns wallets to validators.
 * The deposits and rewards generated by the validator will be withdrawn to the wallet it was assigned.
 */
contract WalletsRegistry is Initializable {
    /**
    * Structure to store information about the wallet assignment.
    * @param unlocked - indicates whether users can withdraw from the wallet.
    * @param validatorId - ID of the validator wallet is attached to.
    */
    struct WalletAssignment {
        bool unlocked;
        bytes32 validatorId;
    }

    // determines whether validator ID (public key hash) has been assigned any wallet.
    mapping(bytes32 => bool) public assignedValidators;

    // maps wallet address to the information about its assignment.
    mapping(address => WalletAssignment) public wallets;

    // address of the Managers contract.
    Managers private managers;

    // address of the ValidatorsRegistry contract.
    ValidatorsRegistry private validatorsRegistry;

    // address of the Withdrawals contract.
    Withdrawals private withdrawals;

    // address of the ProxyFactory contract.
    ProxyFactory private proxyFactory;

    // address of the wallet logical contract.
    address private walletImplementation;

    // wallet initialization data for proxy creation.
    bytes private walletInitData;

    /**
    * Event for tracking wallet new assignment.
    * @param validatorId - ID (public key hash) of the validator wallet is assigned to.
    * @param wallet - address of the wallet the deposits and rewards will be withdrawn to.
    */
    event WalletAssigned(bytes32 validatorId, address indexed wallet);

    /**
    * Event for tracking wallet unlocks.
    * @param validatorId - ID of the validator wallet is assigned to.
    * @param wallet - address of the unlocked wallet.
    * @param usersBalance - users balance at unlock time.
    */
    event WalletUnlocked(bytes32 validatorId, address indexed wallet, uint256 usersBalance);

    /**
    * Constructor for initializing the WalletsRegistry contract.
    * @param _managers - address of the Managers contract.
    * @param _validatorsRegistry - address of the Validators Registry contract.
    * @param _withdrawals - address of the Withdrawals contract.
    * @param _proxyFactory - address of the ProxyFactory contract.
    * @param _walletImplementation - address of the wallet logical contract.
    * @param _walletInitData - wallet initialization data for proxy creation.
    */
    function initialize(
        Managers _managers,
        ValidatorsRegistry _validatorsRegistry,
        Withdrawals _withdrawals,
        ProxyFactory _proxyFactory,
        address _walletImplementation,
        bytes memory _walletInitData
    )
        public initializer
    {
        managers = _managers;
        validatorsRegistry = _validatorsRegistry;
        withdrawals = _withdrawals;
        proxyFactory = _proxyFactory;
        walletImplementation = _walletImplementation;
        walletInitData = _walletInitData;
    }

    /**
    * Function for assigning wallets to validators.
    * Can only be called by users with a manager role.
    * @param _validatorId - ID (public key hash) of the validator wallet should be assigned to.
    */
    function assignWallet(bytes32 _validatorId) external {
        require(!assignedValidators[_validatorId], "Validator has already wallet assigned.");

        (uint256 validatorAmount, ,) = validatorsRegistry.validators(_validatorId);
        require(validatorAmount != 0, "Validator does not have deposit amount.");
        require(managers.isManager(msg.sender), "Permission denied.");

        address wallet = proxyFactory.deployMinimal(walletImplementation, walletInitData);
        wallets[wallet].validatorId = _validatorId;
        assignedValidators[_validatorId] = true;

        emit WalletAssigned(_validatorId, wallet);
    }

    /**
    * Function for unlocking wallets.
    * Can only be called by Withdrawals contract.
    * Users will be able to withdraw their shares from unlocked wallet.
    * @param _wallet - address of the wallet to unlock.
    * @param _usersBalance - users balance at unlock time.
    */
    function unlockWallet(address payable _wallet, uint256 _usersBalance) external {
        require(msg.sender == address(withdrawals), "Permission denied.");
        require(!wallets[_wallet].unlocked, "Wallet is already unlocked.");

        wallets[_wallet].unlocked = true;
        emit WalletUnlocked(wallets[_wallet].validatorId, _wallet, _usersBalance);
    }
}
