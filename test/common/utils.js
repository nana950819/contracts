const fs = require('fs');
const { expectEvent, constants } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { BN, ether, balance } = require('@openzeppelin/test-helpers');
const { initialSettings } = require('../../deployments/settings');
const { validatorRegistrationArgs } = require('./validatorRegistrationArgs');

const Pools = artifacts.require('Pools');
const Solos = artifacts.require('Solos');
const Payments = artifacts.require('Payments');
const Validators = artifacts.require('Validators');
const ValidatorTransfers = artifacts.require('ValidatorTransfers');

function getDepositAmount({
  min = new BN(initialSettings.userDepositMinUnit),
  max = ether('320'),
} = {}) {
  let randomDeposit = ether(Math.random().toFixed(8))
    .mul(max.sub(min))
    .div(ether('1'))
    .add(min);

  return randomDeposit.sub(
    randomDeposit.mod(new BN(initialSettings.userDepositMinUnit))
  );
}

function getEntityId(collectorAddress, entitiesCount) {
  return web3.utils.soliditySha3(collectorAddress, entitiesCount);
}

function getUserId(entityId, sender, recipient) {
  return web3.utils.soliditySha3(entityId, sender, recipient);
}

function removeNetworkFile(network) {
  if (fs.existsSync(`.openzeppelin/${network}.json`)) {
    fs.unlinkSync(`.openzeppelin/${network}.json`);
  }
}

async function checkPendingPool(poolsContract, poolId, expectedPending) {
  let isPending = await poolsContract.pendingPools(poolId);
  expect(isPending).to.equal(expectedPending);
  if (expectedPending) {
    let poolsCounter = await poolsContract.getCounter();
    expect(poolId).to.not.equal(
      getEntityId(poolsContract.address, poolsCounter)
    );
  }
}

async function checkPendingGroup({
  groups,
  groupId,
  payments = constants.ZERO_ADDRESS,
  collectedAmount = new BN(0),
  withdrawalCredentials = null,
}) {
  let pendingGroup = await groups.pendingGroups(groupId);
  expect(pendingGroup.collectedAmount).to.bignumber.equal(collectedAmount);
  expect(pendingGroup.payments).to.equal(payments);
  expect(pendingGroup.withdrawalCredentials).equal(withdrawalCredentials);
}

async function checkPendingSolo({
  solos,
  soloId,
  payments = constants.ZERO_ADDRESS,
  withdrawalCredentials = null,
  amount = new BN(0),
} = {}) {
  let pendingSolo = await solos.pendingSolos(soloId);
  expect(pendingSolo.amount).to.bignumber.equal(amount);
  expect(pendingSolo.payments).to.equal(payments);
  expect(pendingSolo.withdrawalCredentials).equal(withdrawalCredentials);
}

async function checkCollectorBalance(
  collectorContract,
  correctBalance = new BN(0)
) {
  expect(
    await balance.current(collectorContract.address)
  ).to.be.bignumber.equal(correctBalance);
}

async function checkNewPoolCollectedAmount(
  poolsContract,
  correctAmount = new BN(0)
) {
  let collectedAmount = await poolsContract.collectedAmount();
  expect(collectedAmount).to.be.bignumber.equal(correctAmount);
}

async function checkUserTotalAmount({
  depositsContract,
  entityId,
  senderAddress,
  recipientAddress,
  expectedAmount,
}) {
  expect(
    await depositsContract.amounts(
      getUserId(entityId, senderAddress, recipientAddress)
    )
  ).to.be.bignumber.equal(expectedAmount);
}

async function checkDepositAdded({
  transaction,
  depositsContract,
  collectorAddress,
  entityId,
  senderAddress,
  recipientAddress,
  addedAmount,
  totalAmount,
}) {
  // Check event log
  await expectEvent.inTransaction(
    transaction,
    depositsContract,
    'DepositAdded',
    {
      collector: collectorAddress,
      entityId,
      sender: senderAddress,
      recipient: recipientAddress,
      amount: addedAmount,
    }
  );

  // Check user's total amount
  await checkUserTotalAmount({
    depositsContract,
    entityId,
    senderAddress,
    recipientAddress,
    expectedAmount: totalAmount,
  });
}

async function checkDepositCanceled({
  transaction,
  depositsContract,
  collectorAddress,
  entityId,
  senderAddress,
  recipientAddress,
  canceledAmount,
  totalAmount,
}) {
  // Check event log
  await expectEvent.inTransaction(
    transaction,
    depositsContract,
    'DepositCanceled',
    {
      collector: collectorAddress,
      entityId,
      sender: senderAddress,
      recipient: recipientAddress,
      amount: canceledAmount,
    }
  );

  // Check user's total amount
  await checkUserTotalAmount({
    depositsContract,
    entityId,
    senderAddress,
    recipientAddress,
    expectedAmount: totalAmount,
  });
}

async function checkValidatorRegistered({
  vrc,
  transaction,
  pubKey,
  entityId,
  signature,
  validators,
  stakingDuration = new BN(0),
  maintainerFee = new BN(initialSettings.maintainerFee),
  withdrawalCredentials = initialSettings.withdrawalCredentials,
  validatorDepositAmount = new BN(initialSettings.validatorDepositAmount),
}) {
  // Check VRC record created
  await expectEvent.inTransaction(transaction, vrc, 'DepositEvent', {
    pubkey: pubKey,
    withdrawal_credentials: withdrawalCredentials,
    amount: web3.utils.bytesToHex(
      new BN(web3.utils.fromWei(validatorDepositAmount, 'gwei')).toArray(
        'le',
        8
      )
    ),
    signature: signature,
  });

  // Check ValidatorRegistered log emitted
  await expectEvent.inTransaction(
    transaction,
    Validators,
    'ValidatorRegistered',
    {
      pubKey: pubKey,
      entityId,
      withdrawalCredentials,
      stakingDuration,
      depositAmount: validatorDepositAmount,
      maintainerFee,
    }
  );

  // Check validator entry created
  let validator = await validators.validators(web3.utils.soliditySha3(pubKey));
  expect(validator.depositAmount).to.be.bignumber.equal(validatorDepositAmount);
  expect(validator.maintainerFee).to.be.bignumber.equal(maintainerFee);
  expect(validator.entityId).equal(entityId);
}

async function checkValidatorTransferred({
  transaction,
  validatorId,
  newEntityId,
  prevEntityId,
  validators,
  validatorTransfers,
  userDebt,
  totalUserDebt,
  maintainerDebt,
  totalMaintainerDebt,
  newStakingDuration,
  newMaintainerFee = new BN(initialSettings.maintainerFee),
}) {
  // Check ValidatorTransferred log emitted
  await expectEvent.inTransaction(
    transaction,
    ValidatorTransfers,
    'ValidatorTransferred',
    {
      validatorId,
      prevEntityId,
      newEntityId,
      userDebt,
      maintainerDebt,
      newMaintainerFee,
      newStakingDuration,
    }
  );

  // check validator entry update
  let validator = await validators.validators(validatorId);
  expect(validator.maintainerFee).to.be.bignumber.equal(newMaintainerFee);
  expect(validator.entityId).equal(newEntityId);

  // check debt entry created
  let validatorDebt = await validatorTransfers.validatorDebts(validatorId);
  expect(validatorDebt.userDebt).to.be.bignumber.equal(totalUserDebt);
  expect(validatorDebt.maintainerDebt).to.be.bignumber.equal(
    totalMaintainerDebt
  );

  // check previous entity rewards recorded
  let entityReward = await validatorTransfers.entityRewards(prevEntityId);
  expect(entityReward.validatorId).to.equal(validatorId);
  expect(entityReward.amount).to.be.bignumber.equal(userDebt);
}

async function checkPayments(paymentsAddress, totalPrice) {
  let payments = await Payments.at(paymentsAddress);
  expect(await payments.getTotalPrice()).to.be.bignumber.equal(totalPrice);
}

async function registerValidator({
  args = validatorRegistrationArgs[0],
  entityId,
  poolsProxy,
  solosProxy,
  operator,
  sender,
  recipient,
}) {
  let collector;
  if (solosProxy) {
    collector = await Solos.at(solosProxy);
  } else if (poolsProxy) {
    collector = await Pools.at(poolsProxy);
  }

  if (!entityId) {
    // add deposit
    await collector.addDeposit(recipient, {
      from: sender,
      value: initialSettings.validatorDepositAmount,
    });
    // FIXME: invalid if not the first entity created
    entityId = getEntityId(collector.address, new BN(1));
  }

  // register validator for the entity
  await collector.registerValidator(
    args.pubKey,
    args.signature,
    args.hashTreeRoot,
    entityId,
    {
      from: operator,
    }
  );

  return web3.utils.soliditySha3(args.pubKey);
}

function fixSignature(signature) {
  // in geth its always 27/28, in ganache its 0/1. Change to 27/28 to prevent
  // signature malleability if version is 0/1
  // see https://github.com/ethereum/go-ethereum/blob/v1.8.23/internal/ethapi/api.go#L465
  let v = parseInt(signature.slice(130, 132), 16);
  if (v < 27) {
    v += 27;
  }
  const vHex = v.toString(16);
  return signature.slice(0, 130) + vHex;
}

async function signValidatorTransfer(signer, entityId) {
  let messageHash = web3.utils.soliditySha3('validatortransfer', entityId);
  return fixSignature(await web3.eth.sign(messageHash, signer));
}

module.exports = {
  validatorRegistrationArgs,
  registerValidator,
  checkPendingPool,
  checkPendingGroup,
  checkPendingSolo,
  checkPayments,
  checkNewPoolCollectedAmount,
  checkCollectorBalance,
  checkValidatorRegistered,
  checkValidatorTransferred,
  removeNetworkFile,
  getDepositAmount,
  signValidatorTransfer,
  getEntityId,
  checkUserTotalAmount,
  checkDepositAdded,
  checkDepositCanceled,
};
