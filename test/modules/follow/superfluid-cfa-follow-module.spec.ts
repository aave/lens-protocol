import { BigNumber } from '@ethersproject/bignumber';
import { parseEther } from '@ethersproject/units';
import '@nomiclabs/hardhat-ethers';
import deployFramework from '@superfluid-finance/ethereum-contracts/scripts/deploy-framework.js';
import deployTestToken from '@superfluid-finance/ethereum-contracts/scripts/deploy-test-token.js';
import deploySuperToken from '@superfluid-finance/ethereum-contracts/scripts/deploy-super-token.js';
import { Framework, SuperToken } from '@superfluid-finance/sdk-core';
import { expect } from 'chai';
import * as hre from 'hardhat';
import {
    Currency,
    SuperfluidCFAFollowModule,
    SuperfluidCFAFollowModule__factory,
} from '../../../typechain-types';
import { MAX_UINT256, ZERO_ADDRESS } from '../../helpers/constants';
import { ERRORS } from '../../helpers/errors';
import { getTimestamp, matchEvent, mine, setNextBlockTimestamp, waitForTx } from '../../helpers/utils';
import {
    abiCoder,
    BPS_MAX,
    FIRST_PROFILE_ID,
    governance,
    lensHub,
    lensHubImpl,
    makeSuiteCleanRoom,
    MOCK_FOLLOW_NFT_URI,
    MOCK_PROFILE_HANDLE,
    MOCK_PROFILE_URI,
    moduleGlobals,
    treasuryAddress,
    TREASURY_FEE_BPS,
    userAddress,
    userTwo,
    userTwoAddress,
    deployerAddress,
    deployer,
    CURRENCY_MINT_AMOUNT,
} from '../../__setup.spec';

let fDAI: Currency;
let fDAIx: SuperToken;
let superfluidCFAFollowModule: SuperfluidCFAFollowModule;
let sf: Framework;

function errorHandler(err: Error): void {
    if (err) throw err;
}

async function muteLogs(fn: () => Promise<void>): Promise<void> {
    // FIXME: Superfluid deploy helpers should have an option to disable logs
    const log = console.log;
    const debug = console.debug;
    console.log = () => { };
    console.debug = () => { };
    try {
        await fn();
    } finally {
        console.log = log;
        console.debug = debug;
    }
}

makeSuiteCleanRoom('Superfluid CFA Follow Module', function() {
    const DEFAULT_FOLLOW_PRICE = parseEther('10');
    // Flow rate per seconds
    // ❓precision lost here. DEFAULT_FOLLOW_FLOW_RATE.mul(30 * 24 * 60 * 60) != DEFAULT_FOLLOW_PRICE
    const DEFAULT_FOLLOW_FLOW_RATE = DEFAULT_FOLLOW_PRICE.div(30 * 24 * 60 * 60);

    before(async function() {
        await muteLogs(async () => {
            //deploy the framework
            await deployFramework(errorHandler, {
                web3: hre.web3,
                from: deployerAddress,
            });
            // initialize the superfluid framework...put custom and web3 only bc we are using hardhat locally
            sf = await Framework.create({
                networkName: 'custom',
                provider: hre.ethers.provider,
                dataMode: 'WEB3_ONLY',
                resolverAddress: process.env.RESOLVER_ADDRESS, //this is how you get the resolver address
                protocolReleaseVersion: 'test',
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
            // use the framework to get the super token
            fDAIx = await sf.loadSuperToken('fDAIx');
            const fDAIAddress = fDAIx.underlyingToken.address;
            fDAI = (await hre.ethers.getContractAt('Currency', fDAIAddress, deployer)) as Currency;
        });

        superfluidCFAFollowModule = await new SuperfluidCFAFollowModule__factory(deployer).deploy(
            lensHub.address,
            moduleGlobals.address,
            sf.host.hostContract.address
        );
    })

    beforeEach(async function() {
        await expect(
            lensHub.connect(governance).whitelistFollowModule(superfluidCFAFollowModule.address, true)
        ).to.not.be.reverted;
        await expect(
            moduleGlobals.connect(governance).whitelistCurrency(fDAIx.address, true)
        ).to.not.be.reverted;
    });

    context('Negatives', function() {
        context('Initialization', function() {
            it('user should fail to create a profile with superfluid cfa follow module using unwhitelisted currency', async function() {
                const followModuleInitData = abiCoder.encode(
                    ['address', 'address', 'uint256', 'uint96'],
                    [userAddress, userTwoAddress, DEFAULT_FOLLOW_PRICE, DEFAULT_FOLLOW_FLOW_RATE]
                );

                await expect(
                    lensHub.createProfile({
                        to: userAddress,
                        handle: MOCK_PROFILE_HANDLE,
                        imageURI: MOCK_PROFILE_URI,
                        followModule: superfluidCFAFollowModule.address,
                        followModuleInitData,
                        followNFTURI: MOCK_FOLLOW_NFT_URI,
                    })
                ).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
            });

            it('user should fail to create a profile with superfluid cfa follow module using zero recipient', async function() {
                const followModuleInitData = abiCoder.encode(
                    ['address', 'address', 'uint256', 'uint96'],
                    [ZERO_ADDRESS, fDAIx.address, DEFAULT_FOLLOW_PRICE, DEFAULT_FOLLOW_FLOW_RATE]
                );

                await expect(
                    lensHub.createProfile({
                        to: userAddress,
                        handle: MOCK_PROFILE_HANDLE,
                        imageURI: MOCK_PROFILE_URI,
                        followModule: superfluidCFAFollowModule.address,
                        followModuleInitData,
                        followNFTURI: MOCK_FOLLOW_NFT_URI,
                    })
                ).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
            });

            it('user should fail to create a profile with superfluid cfa follow module using zero flow rate', async function() {
                const followModuleInitData = abiCoder.encode(
                    ['address', 'address', 'uint256', 'uint96'],
                    [userAddress, fDAIx.address, DEFAULT_FOLLOW_PRICE, 0]
                );

                await expect(
                    lensHub.createProfile({
                        to: userAddress,
                        handle: MOCK_PROFILE_HANDLE,
                        imageURI: MOCK_PROFILE_URI,
                        followModule: superfluidCFAFollowModule.address,
                        followModuleInitData,
                        followNFTURI: MOCK_FOLLOW_NFT_URI,
                    })
                ).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
            });
        });

        context('Following', function() {
            beforeEach(async function() {
                const followModuleInitData = abiCoder.encode(
                    ['address', 'address', 'uint256', 'uint96'],
                    [userAddress, fDAIx.address, DEFAULT_FOLLOW_PRICE, DEFAULT_FOLLOW_FLOW_RATE]
                );
                await expect(
                    lensHub.createProfile({
                        to: userAddress,
                        handle: MOCK_PROFILE_HANDLE,
                        imageURI: MOCK_PROFILE_URI,
                        followModule: superfluidCFAFollowModule.address,
                        followModuleInitData,
                        followNFTURI: MOCK_FOLLOW_NFT_URI,
                    })
                ).to.not.be.reverted;
            });

            it('UserTwo should fail to follow passing a different expected currency in data', async function() {
                const data = abiCoder.encode(['address', 'uint256'], [userAddress, DEFAULT_FOLLOW_PRICE]);
                await expect(
                    lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [data])
                ).to.be.revertedWith(ERRORS.MODULE_DATA_MISMATCH);
            });

            it('UserTwo should fail to follow passing a different expected price in data', async function() {
                const data = abiCoder.encode(
                    ['address', 'uint256'],
                    [fDAIx.address, DEFAULT_FOLLOW_PRICE.add(1)]
                );
                await expect(
                    lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [data])
                ).to.be.revertedWith(ERRORS.MODULE_DATA_MISMATCH);
            });

            it('UserTwo should fail to follow without sufficient currency balance', async function() {
                const data = abiCoder.encode(
                    ['address', 'uint256'],
                    [fDAIx.address, DEFAULT_FOLLOW_PRICE]
                );
                await expect(
                    lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [data])
                ).to.be.revertedWith(ERRORS.SUPER_TOKEN_TRANSFER_EXCEEDS_BALANCE);
            });

            it('UserTwo should fail to follow without first approving module with enough currency', async function() {
                await expect(fDAI.connect(userTwo).mint(userTwoAddress, CURRENCY_MINT_AMOUNT)).to.not.be.reverted;
                await expect(fDAI.connect(userTwo).approve(fDAIx.address, MAX_UINT256)).to.not.be.reverted;
                await expect(fDAIx.upgrade({ amount: CURRENCY_MINT_AMOUNT.toHexString() }).exec(userTwo)).to.not.be.reverted;
                expect(await fDAIx.balanceOf({ account: userTwoAddress, providerOrSigner: userTwo })).to.eq(CURRENCY_MINT_AMOUNT.toString());

                const data = abiCoder.encode(
                    ['address', 'uint256'],
                    [fDAIx.address, DEFAULT_FOLLOW_PRICE]
                );
                await expect(
                    lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [data])
                ).to.be.revertedWith(ERRORS.SUPER_TOKEN_TRANSFER_EXCEEDS_ALLOWANCE);
            });

            it('UserTwo should fail to follow without first creating a constant flow agreement', async function() {
                await expect(fDAI.connect(userTwo).mint(userTwoAddress, CURRENCY_MINT_AMOUNT)).to.not.be.reverted;
                await expect(fDAI.connect(userTwo).approve(fDAIx.address, MAX_UINT256)).to.not.be.reverted;
                await expect(fDAIx.upgrade({ amount: CURRENCY_MINT_AMOUNT.toString() }).exec(userTwo)).to.not.be.reverted;
                await expect(fDAIx.approve({ amount: MAX_UINT256, receiver: superfluidCFAFollowModule.address }).exec(userTwo)).to.not.be.reverted;

                const data = abiCoder.encode(
                    ['address', 'uint256'],
                    [fDAIx.address, DEFAULT_FOLLOW_PRICE]
                );
                await expect(
                    lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [data])
                ).to.be.revertedWith(ERRORS.CFA_INVALID);
            });

            it('UserTwo should fail to follow without first creating a constant flow agreement with the correct recipient', async function() {
                await expect(fDAI.connect(userTwo).mint(userTwoAddress, CURRENCY_MINT_AMOUNT)).to.not.be.reverted;
                await expect(fDAI.connect(userTwo).approve(fDAIx.address, MAX_UINT256)).to.not.be.reverted;
                await expect(fDAIx.upgrade({ amount: CURRENCY_MINT_AMOUNT.toString() }).exec(userTwo)).to.not.be.reverted;
                await expect(fDAIx.approve({ amount: MAX_UINT256, receiver: superfluidCFAFollowModule.address }).exec(userTwo)).to.not.be.reverted;
                await expect(sf.cfaV1.createFlow({
                    superToken: fDAIx.address,
                    receiver: superfluidCFAFollowModule.address,
                    flowRate: DEFAULT_FOLLOW_FLOW_RATE.toString(),
                }).exec(userTwo)).to.not.be.reverted;

                const data = abiCoder.encode(
                    ['address', 'uint256'],
                    [fDAIx.address, DEFAULT_FOLLOW_PRICE]
                );
                await expect(
                    lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [data])
                ).to.be.revertedWith(ERRORS.CFA_INVALID);
            });

            it('UserTwo should fail to follow without first creating a constant flow agreement with the correct currency', async function() {
                await muteLogs(async () => {
                    // deploy a fake erc20 token
                    await deployTestToken(errorHandler, [":", "fDAI2"], {
                        web3: hre.web3,
                        from: deployerAddress,
                    });
                    //deploy a fake erc20 wrapper super token around the fDAI token
                    await deploySuperToken(errorHandler, [":", "fDAI2"], {
                        web3: hre.web3,
                        from: deployerAddress,
                    });
                });
                //use the framework to get the super toen
                const fDAI2x = await sf.loadSuperToken('fDAI2x');
                const fDAI2 = (await hre.ethers.getContractAt('Currency', fDAI2x.underlyingToken.address, deployer)) as Currency;
                await expect(fDAI2.connect(userTwo).mint(userTwoAddress, CURRENCY_MINT_AMOUNT)).to.not.be.reverted;
                await expect(fDAI2.connect(userTwo).approve(fDAI2x.address, MAX_UINT256)).to.not.be.reverted;
                await expect(fDAI2x.upgrade({ amount: CURRENCY_MINT_AMOUNT.toString() }).exec(userTwo)).to.not.be.reverted;
                await expect(sf.cfaV1.createFlow({
                    superToken: fDAI2x.address,
                    receiver: userAddress,
                    flowRate: DEFAULT_FOLLOW_FLOW_RATE.toString(),
                }).exec(userTwo)).to.not.be.reverted;
                await expect(fDAI.connect(userTwo).mint(userTwoAddress, CURRENCY_MINT_AMOUNT)).to.not.be.reverted;
                await expect(fDAI.connect(userTwo).approve(fDAIx.address, MAX_UINT256)).to.not.be.reverted;
                await expect(fDAIx.upgrade({ amount: CURRENCY_MINT_AMOUNT.toString() }).exec(userTwo)).to.not.be.reverted;
                await expect(fDAIx.approve({ amount: MAX_UINT256, receiver: superfluidCFAFollowModule.address }).exec(userTwo)).to.not.be.reverted;

                const data = abiCoder.encode(
                    ['address', 'uint256'],
                    [fDAIx.address, DEFAULT_FOLLOW_PRICE]
                );
                await expect(
                    lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [data])
                ).to.be.revertedWith(ERRORS.CFA_INVALID);
            });

            it('UserTwo should fail to follow without first creating a constant flow agreement with the correct flow rate', async function() {
                await expect(fDAI.connect(userTwo).mint(userTwoAddress, CURRENCY_MINT_AMOUNT)).to.not.be.reverted;
                await expect(fDAI.connect(userTwo).approve(fDAIx.address, MAX_UINT256)).to.not.be.reverted;
                await expect(fDAIx.upgrade({ amount: CURRENCY_MINT_AMOUNT.toString() }).exec(userTwo)).to.not.be.reverted;
                await expect(fDAIx.approve({ amount: MAX_UINT256, receiver: superfluidCFAFollowModule.address }).exec(userTwo)).to.not.be.reverted;
                await expect(sf.cfaV1.createFlow({
                    superToken: fDAIx.address,
                    receiver: userAddress,
                    flowRate: DEFAULT_FOLLOW_FLOW_RATE.sub(1).toString(),
                }).exec(userTwo)).to.not.be.reverted;

                const data = abiCoder.encode(
                    ['address', 'uint256'],
                    [fDAIx.address, DEFAULT_FOLLOW_PRICE]
                );
                await expect(
                    lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [data])
                ).to.be.revertedWith(ERRORS.CFA_INVALID);
            });

            it('UserTwo should fail to follow if they are already following', async function() {
                await expect(fDAI.connect(userTwo).mint(userTwoAddress, CURRENCY_MINT_AMOUNT)).to.not.be.reverted;
                await expect(fDAI.connect(userTwo).approve(fDAIx.address, MAX_UINT256)).to.not.be.reverted;
                await expect(fDAIx.upgrade({ amount: CURRENCY_MINT_AMOUNT.toString() }).exec(userTwo)).to.not.be.reverted;
                await expect(fDAIx.approve({ amount: MAX_UINT256, receiver: superfluidCFAFollowModule.address }).exec(userTwo)).to.not.be.reverted;
                await expect(sf.cfaV1.createFlow({
                    superToken: fDAIx.address,
                    receiver: userAddress,
                    flowRate: DEFAULT_FOLLOW_FLOW_RATE.toString(),
                }).exec(userTwo)).to.not.be.reverted;

                const data = abiCoder.encode(
                    ['address', 'uint256'],
                    [fDAIx.address, DEFAULT_FOLLOW_PRICE]
                );
                await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [data])).to.not.be.reverted;
                await expect(
                    lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [data])
                ).to.be.revertedWith(ERRORS.FOLLOW_INVALID);
            });

            it('UserTwo should fail to validate follow if they are not following', async function() {
                expect(await superfluidCFAFollowModule.connect(userTwo).isFollowing(FIRST_PROFILE_ID, userTwoAddress, 0)).to.be.eq(false);
            });

            it('UserTwo should fail to validate follow if they deleted the cfa', async function() {
                await expect(fDAI.connect(userTwo).mint(userTwoAddress, CURRENCY_MINT_AMOUNT)).to.not.be.reverted;
                await expect(fDAI.connect(userTwo).approve(fDAIx.address, MAX_UINT256)).to.not.be.reverted;
                await expect(fDAIx.upgrade({ amount: CURRENCY_MINT_AMOUNT.toString() }).exec(userTwo)).to.not.be.reverted;
                await expect(fDAIx.approve({ amount: MAX_UINT256, receiver: superfluidCFAFollowModule.address }).exec(userTwo)).to.not.be.reverted;
                await expect(sf.cfaV1.createFlow({
                    superToken: fDAIx.address,
                    receiver: userAddress,
                    flowRate: DEFAULT_FOLLOW_FLOW_RATE.toString(),
                }).exec(userTwo)).to.not.be.reverted;

                const data = abiCoder.encode(
                    ['address', 'uint256'],
                    [fDAIx.address, DEFAULT_FOLLOW_PRICE]
                );
                await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [data])).to.not.be.reverted;
                await expect(sf.cfaV1.deleteFlow({
                    superToken: fDAIx.address,
                    sender: userTwoAddress,
                    receiver: userAddress,
                }).exec(userTwo)).to.not.be.reverted;
                expect(await superfluidCFAFollowModule.connect(userTwo).isFollowing(FIRST_PROFILE_ID, userTwoAddress, 0)).to.be.eq(false);
            });

            it('UserTwo should fail to validate follow if they updated the cfa', async function() {
                await expect(fDAI.connect(userTwo).mint(userTwoAddress, CURRENCY_MINT_AMOUNT)).to.not.be.reverted;
                await expect(fDAI.connect(userTwo).approve(fDAIx.address, MAX_UINT256)).to.not.be.reverted;
                await expect(fDAIx.upgrade({ amount: CURRENCY_MINT_AMOUNT.toString() }).exec(userTwo)).to.not.be.reverted;
                await expect(fDAIx.approve({ amount: MAX_UINT256, receiver: superfluidCFAFollowModule.address }).exec(userTwo)).to.not.be.reverted;
                await expect(sf.cfaV1.createFlow({
                    superToken: fDAIx.address,
                    receiver: userAddress,
                    flowRate: DEFAULT_FOLLOW_FLOW_RATE.toString(),
                }).exec(userTwo)).to.not.be.reverted;

                const data = abiCoder.encode(
                    ['address', 'uint256'],
                    [fDAIx.address, DEFAULT_FOLLOW_PRICE]
                );
                await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [data])).to.not.be.reverted;
                await expect(sf.cfaV1.updateFlow({
                    superToken: fDAIx.address,
                    sender: userTwoAddress,
                    receiver: userAddress,
                    flowRate: DEFAULT_FOLLOW_FLOW_RATE.mul(2).toString(),
                }).exec(userTwo)).to.not.be.reverted;
                expect(await superfluidCFAFollowModule.connect(userTwo).isFollowing(FIRST_PROFILE_ID, userTwoAddress, 0)).to.be.eq(false);
            });

            it('UserTwo should fail to validate follow if they recreated the cfa', async function() {
                await expect(fDAI.connect(userTwo).mint(userTwoAddress, CURRENCY_MINT_AMOUNT)).to.not.be.reverted;
                await expect(fDAI.connect(userTwo).approve(fDAIx.address, MAX_UINT256)).to.not.be.reverted;
                await expect(fDAIx.upgrade({ amount: CURRENCY_MINT_AMOUNT.toString() }).exec(userTwo)).to.not.be.reverted;
                await expect(fDAIx.approve({ amount: MAX_UINT256, receiver: superfluidCFAFollowModule.address }).exec(userTwo)).to.not.be.reverted;
                await expect(sf.cfaV1.createFlow({
                    superToken: fDAIx.address,
                    receiver: userAddress,
                    flowRate: DEFAULT_FOLLOW_FLOW_RATE.toString(),
                }).exec(userTwo)).to.not.be.reverted;

                const data = abiCoder.encode(
                    ['address', 'uint256'],
                    [fDAIx.address, DEFAULT_FOLLOW_PRICE]
                );
                await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [data])).to.not.be.reverted;
                await expect(sf.cfaV1.deleteFlow({
                    superToken: fDAIx.address,
                    sender: userTwoAddress,
                    receiver: userAddress,
                }).exec(userTwo)).to.not.be.reverted;
                await expect(sf.cfaV1.createFlow({
                    superToken: fDAIx.address,
                    receiver: userAddress,
                    flowRate: DEFAULT_FOLLOW_FLOW_RATE.toString(),
                }).exec(userTwo)).to.not.be.reverted;
                expect(await superfluidCFAFollowModule.connect(userTwo).isFollowing(FIRST_PROFILE_ID, userTwoAddress, 0)).to.be.eq(false);
            });
        });
    });

    context('Scenarios', function() {
        it('User should create a profile with the superfluid cfa follow module as the follow module and data, correct events should be emitted', async function() {
            const followModuleInitData = abiCoder.encode(
                ['address', 'address', 'uint256', 'uint96'],
                [userAddress, fDAIx.address, DEFAULT_FOLLOW_PRICE, DEFAULT_FOLLOW_FLOW_RATE]
            );
            const tx = lensHub.createProfile({
                to: userAddress,
                handle: MOCK_PROFILE_HANDLE,
                imageURI: MOCK_PROFILE_URI,
                followModule: superfluidCFAFollowModule.address,
                followModuleInitData,
                followNFTURI: MOCK_FOLLOW_NFT_URI,
            });

            const receipt = await waitForTx(tx);

            expect(receipt.logs.length).to.eq(2);
            matchEvent(receipt, 'Transfer', [ZERO_ADDRESS, userAddress, FIRST_PROFILE_ID], lensHubImpl);
            matchEvent(receipt, 'ProfileCreated', [
                FIRST_PROFILE_ID,
                userAddress,
                userAddress,
                MOCK_PROFILE_HANDLE,
                MOCK_PROFILE_URI,
                superfluidCFAFollowModule.address,
                followModuleInitData,
                MOCK_FOLLOW_NFT_URI,
                await getTimestamp(),
            ]);
        });

        it('User should create a profile with superfluid cfa follow module using zero amount', async function() {
            const followModuleInitData = abiCoder.encode(
                ['address', 'address', 'uint256', 'uint96'],
                [userAddress, fDAIx.address, 0, DEFAULT_FOLLOW_FLOW_RATE]
            );

            await expect(
                lensHub.createProfile({
                    to: userAddress,
                    handle: MOCK_PROFILE_HANDLE,
                    imageURI: MOCK_PROFILE_URI,
                    followModule: superfluidCFAFollowModule.address,
                    followModuleInitData,
                    followNFTURI: MOCK_FOLLOW_NFT_URI,
                })
            ).to.not.be.reverted;
        });

        it('User should create a profile then set the superfluid cfa follow module as the follow module with data, correct events should be emitted', async function() {
            await expect(
                lensHub.createProfile({
                    to: userAddress,
                    handle: MOCK_PROFILE_HANDLE,
                    imageURI: MOCK_PROFILE_URI,
                    followModule: ZERO_ADDRESS,
                    followModuleInitData: [],
                    followNFTURI: MOCK_FOLLOW_NFT_URI,
                })
            ).to.not.be.reverted;

            const followModuleInitData = abiCoder.encode(
                ['address', 'address', 'uint256', 'uint96'],
                [userAddress, fDAIx.address, DEFAULT_FOLLOW_PRICE, DEFAULT_FOLLOW_FLOW_RATE]
            );
            const tx = lensHub.setFollowModule(
                FIRST_PROFILE_ID,
                superfluidCFAFollowModule.address,
                followModuleInitData
            );

            const receipt = await waitForTx(tx);

            expect(receipt.logs.length).to.eq(1);
            matchEvent(receipt, 'FollowModuleSet', [
                FIRST_PROFILE_ID,
                superfluidCFAFollowModule.address,
                followModuleInitData,
                await getTimestamp(),
            ]);
        });

        it('User should create a profile with the superfluid cfa follow module as the follow module and data, fetched profile data should be accurate', async function() {
            const followModuleInitData = abiCoder.encode(
                ['address', 'address', 'uint256', 'uint96'],
                [userAddress, fDAIx.address, DEFAULT_FOLLOW_PRICE, DEFAULT_FOLLOW_FLOW_RATE]
            );
            await expect(
                lensHub.createProfile({
                    to: userAddress,
                    handle: MOCK_PROFILE_HANDLE,
                    imageURI: MOCK_PROFILE_URI,
                    followModule: superfluidCFAFollowModule.address,
                    followModuleInitData,
                    followNFTURI: MOCK_FOLLOW_NFT_URI,
                })
            ).to.not.be.reverted;

            const fetchedData = await superfluidCFAFollowModule.getProfileData(FIRST_PROFILE_ID);
            expect(fetchedData.recipient).to.eq(userAddress);
            expect(fetchedData.currency).to.eq(fDAIx.address);
            expect(fetchedData.amount).to.eq(DEFAULT_FOLLOW_PRICE);
            expect(fetchedData.flowRate).to.eq(DEFAULT_FOLLOW_FLOW_RATE);
        });

        it('User should create a profile with the superfluid cfa follow module as the follow module and data, user two create a cfa and follows, fee distribution is valid', async function() {
            const followModuleInitData = abiCoder.encode(
                ['address', 'address', 'uint256', 'uint96'],
                [userAddress, fDAIx.address, DEFAULT_FOLLOW_PRICE, DEFAULT_FOLLOW_FLOW_RATE]
            );
            await expect(
                lensHub.createProfile({
                    to: userAddress,
                    handle: MOCK_PROFILE_HANDLE,
                    imageURI: MOCK_PROFILE_URI,
                    followModule: superfluidCFAFollowModule.address,
                    followModuleInitData,
                    followNFTURI: MOCK_FOLLOW_NFT_URI,
                })
            ).to.not.be.reverted;

            await expect(fDAI.connect(userTwo).mint(userTwoAddress, CURRENCY_MINT_AMOUNT)).to.not.be.reverted;
            await expect(fDAI.connect(userTwo).approve(fDAIx.address, CURRENCY_MINT_AMOUNT)).to.not.be.reverted;
            await expect(fDAIx.upgrade({ amount: CURRENCY_MINT_AMOUNT.toString() }).exec(userTwo)).to.not.be.reverted;
            await expect(fDAIx.approve({ amount: MAX_UINT256, receiver: superfluidCFAFollowModule.address }).exec(userTwo)).to.not.be.reverted;
            await expect(sf.cfaV1.createFlow({
                superToken: fDAIx.address,
                receiver: userAddress,
                flowRate: DEFAULT_FOLLOW_FLOW_RATE.toString(),
            }).exec(userTwo)).to.not.be.reverted;

            const cfaCreationTimestamp = await getTimestamp();

            const data = abiCoder.encode(
                ['address', 'uint256'],
                [fDAIx.address, DEFAULT_FOLLOW_PRICE]
            );
            await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [data])).to.not.be.reverted;

            const expectedTreasuryAmount = BigNumber.from(DEFAULT_FOLLOW_PRICE)
                .mul(TREASURY_FEE_BPS)
                .div(BPS_MAX);
            const expectedRecipientAmount = BigNumber.from(DEFAULT_FOLLOW_PRICE).sub(expectedTreasuryAmount);

            await setNextBlockTimestamp(Number(cfaCreationTimestamp) + 30 * 24 * 60 * 60);
            await mine(1);

            expect(await fDAIx.balanceOf({ account: treasuryAddress, providerOrSigner: userTwo })).to.eq(expectedTreasuryAmount);
            expect(await fDAIx.balanceOf({ account: userAddress, providerOrSigner: userTwo })).to.eq(
                expectedRecipientAmount.add(DEFAULT_FOLLOW_FLOW_RATE.mul(30 * 24 * 60 * 60))
            );
            expect(await fDAIx.balanceOf({ account: userTwoAddress, providerOrSigner: userTwo })).to.eq(
                CURRENCY_MINT_AMOUNT
                    .sub(DEFAULT_FOLLOW_PRICE)
                    // Superfluid takes a 1h deposit up front on escrow on testnets
                    // https://docs.superfluid.finance/superfluid/protocol-developers/interactive-tutorials/money-streaming-1#money-streaming
                    .sub(DEFAULT_FOLLOW_FLOW_RATE.mul(1 * 60 * 60))
                    .sub(DEFAULT_FOLLOW_FLOW_RATE.mul(30 * 24 * 60 * 60))
                    .sub('259256864') // FIXME due to loss of precision ?
            );
        });
    });
});
