import * as fs from 'fs';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-web3';
import { Framework } from '@superfluid-finance/sdk-core';
import deployFramework from '@superfluid-finance/ethereum-contracts/scripts/deploy-framework.js';
import deployTestToken from '@superfluid-finance/ethereum-contracts/scripts/deploy-test-token.js';
import deploySuperToken from '@superfluid-finance/ethereum-contracts/scripts/deploy-super-token.js';
import { task } from 'hardhat/config';

function errorHandler(err: Error): void {
    if (err) throw err;
}

task('test-deploy-superfluid', 'deploys the superfluid protocol for testing purposes').setAction(async ({ }, hre) => {
    const accounts = await hre.ethers.getSigners();
    const deployer = accounts[0];
    const deployerAddress = await deployer.getAddress();

    if (hre.network.name != 'localhost') {
        throw new Error('🚫 Local deployment only script');
    }
    //deploy the framework
    await deployFramework(errorHandler, {
        web3: hre.web3,
        from: deployerAddress,
    });
    // deploy a fake erc20 token
    await deployTestToken(errorHandler, [":", "fDAI"], {
        web3: hre.web3,
        from: deployerAddress,
    });
    // deploy a fake erc20 wrapper super token around the currency token
    await deploySuperToken(errorHandler, [':', 'fDAI'], {
        web3: hre.web3,
        from: deployerAddress,
    });

    // initialize the superfluid framework...put custom and web3 only bc we are using hardhat locally
    const sf = await Framework.create({
        networkName: "custom",
        dataMode: "WEB3_ONLY",
        resolverAddress: process.env.RESOLVER_ADDRESS,
        protocolReleaseVersion: "test",
        provider: hre.ethers.provider,
    });
    const fDAIx = await sf.loadSuperToken('fDAIx');
    const addresses = {
        'superfluid host': sf.host.hostContract.address,
        fDAI: fDAIx.underlyingToken.address,
        fDAIx: fDAIx.address,
    }
    const json = JSON.stringify(addresses, null, 2);
    console.log(json);

    fs.writeFileSync('addresses-superfluid.json', json, 'utf-8');
});
