import '@nomiclabs/hardhat-ethers';
import { task } from 'hardhat/config';
import { ModuleGlobals__factory } from '../typechain-types';
import { waitForTx } from './helpers/utils';

task('allowlist-currency', 'allowlists a currency in the module globals')
  .addParam('gov')
  .addParam('globals')
  .addParam('currency')
  .addParam('allowlist')
  .setAction(async ({ gov, globals, currency, allowlist }, hre) => {
    const ethers = hre.ethers;
    const governance = await ethers.getSigner(gov);

    const moduleGlobals = ModuleGlobals__factory.connect(globals, governance);

    await waitForTx(moduleGlobals.connect(governance).allowlistCurrency(currency, allowlist));
  });
