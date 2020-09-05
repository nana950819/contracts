const { scripts } = require('@openzeppelin/cli');
const { BN } = require('@openzeppelin/test-helpers');

const ERC20Mock = artifacts.require('ERC20MockUpgradeSafe');

async function deployDAI(initialHolder, params = {}) {
  const name = 'DAI';
  const symbol = 'DAI';
  const initialSupply = new BN(100000000).mul(new BN(10).pow(new BN(18)));
  return ERC20Mock.new(name, symbol, initialHolder, initialSupply, params);
}

async function deploySWDToken({
  swrTokenProxy,
  settingsProxy,
  poolProxy,
  salt,
  networkConfig,
}) {
  const proxy = await scripts.create({
    contractAlias: 'SWDToken',
    methodName: 'initialize',
    methodArgs: [swrTokenProxy, settingsProxy, poolProxy],
    salt,
    ...networkConfig,
  });

  return proxy.address;
}

async function deploySWRToken({
  swdTokenProxy,
  settingsProxy,
  validatorsOracleProxy,
  salt,
  networkConfig,
}) {
  const proxy = await scripts.create({
    contractAlias: 'SWRToken',
    methodName: 'initialize',
    methodArgs: [swdTokenProxy, settingsProxy, validatorsOracleProxy],
    salt,
    ...networkConfig,
  });

  return proxy.address;
}

module.exports = {
  deployDAI,
  deploySWDToken,
  deploySWRToken,
};
