// SPDX-License-Identifier: GPL-3.0-only

pragma solidity 0.6.12;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "./interfaces/IAdmins.sol";
import "./interfaces/IOperators.sol";
import "./interfaces/ISettings.sol";

/**
 * @title Settings
 *
 * @dev Contract for storing global settings.
 * Can mostly be changed by accounts with an admin role.
 */
contract Settings is ISettings, Initializable {
    // @dev The address of the application owner, where the fee will be paid.
    address payable public override maintainer;

    // @dev The percentage fee users pay from their reward for using the service.
    uint64 public override maintainerFee;

    // @dev The minimum unit (wei, gwei, etc.) deposit can have.
    uint64 public override minDepositUnit;

    // @dev The deposit amount required to become an Ethereum validator.
    uint128 public override validatorDepositAmount;

    // @dev The maximum deposit amount.
    uint256 public override maxDepositAmount;

    // @dev The non-custodial validator price per second.
    uint256 public override validatorPrice;

    // @dev The withdrawal credentials used to initiate validator withdrawal from the beacon chain.
    bytes public override withdrawalCredentials;

    // @dev The mapping between the managed contract and whether it is paused or not.
    mapping(address => bool) public override pausedContracts;

    // @dev Address of the Admins contract.
    IAdmins private admins;

    // @dev Address of the Operators contract.
    IOperators private operators;

    /**
     * @dev See {ISettings-initialize}.
     */
    function initialize(
        address payable _maintainer,
        uint16 _maintainerFee,
        uint64 _minDepositUnit,
        uint128 _validatorDepositAmount,
        uint256 _maxDepositAmount,
        uint256 _validatorPrice,
        bytes memory _withdrawalCredentials,
        address _admins,
        address _operators
    )
        public override initializer
    {
        maintainer = _maintainer;
        maintainerFee = _maintainerFee;
        minDepositUnit = _minDepositUnit;
        validatorDepositAmount = _validatorDepositAmount;
        maxDepositAmount = _maxDepositAmount;
        validatorPrice = _validatorPrice;
        withdrawalCredentials = _withdrawalCredentials;
        admins = IAdmins(_admins);
        operators = IOperators(_operators);
    }

    /**
     * @dev See {ISettings-setMinDepositUnit}.
     */
    function setMinDepositUnit(uint64 newValue) external override {
        require(admins.isAdmin(msg.sender), "Permission denied.");

        minDepositUnit = newValue;
        emit SettingChanged("minDepositUnit");
    }

    /**
     * @dev See {ISettings-setMaxDepositAmount}.
     */
    function setMaxDepositAmount(uint256 newValue) external override {
        require(admins.isAdmin(msg.sender), "Permission denied.");

        maxDepositAmount = newValue;
        emit SettingChanged("maxDepositAmount");
    }

    /**
     * @dev See {ISettings-setMaintainer}.
     */
    function setMaintainer(address payable newValue) external override {
        require(admins.isAdmin(msg.sender), "Permission denied.");

        maintainer = newValue;
        emit SettingChanged("maintainer");
    }

    /**
     * @dev See {ISettings-setMaintainerFee}.
     */
    function setMaintainerFee(uint64 newValue) external override {
        require(admins.isAdmin(msg.sender), "Permission denied.");
        require(newValue < 10000, "Invalid value.");

        maintainerFee = newValue;
        emit SettingChanged("maintainerFee");
    }

    /**
     * @dev See {ISettings-setContractPaused}.
     */
    function setContractPaused(address _contract, bool isPaused) external override {
        require(admins.isAdmin(msg.sender) || operators.isOperator(msg.sender), "Permission denied.");

        pausedContracts[_contract] = isPaused;
        emit SettingChanged("pausedContracts");
    }

    /**
     * @dev See {ISettings-setValidatorPrice}.
     */
    function setValidatorPrice(uint256 _validatorPrice) external override {
        require(admins.isAdmin(msg.sender), "Permission denied.");

        validatorPrice = _validatorPrice;
        emit SettingChanged("validatorPrice");
    }
}
