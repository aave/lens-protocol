import { parseEther } from '@ethersproject/units';
import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { ERRORS } from '../../helpers/errors';
import { getTimestamp, matchEvent, waitForTx } from '../../helpers/utils';
import {
    abiCoder,
    currency,
    FIRST_PROFILE_ID,
    governance,
    lensHubImpl,
    lensHub,
    tokenGatedFollowModule,
    makeSuiteCleanRoom,
    MOCK_FOLLOW_NFT_URI,
    MOCK_PROFILE_HANDLE,
    MOCK_PROFILE_URI,
    userAddress,
    userTwo,
    userTwoAddress,
} from '../../__setup.spec';


makeSuiteCleanRoom('Token Gated Follow Module', function () {
    const TOKENS_NEEDED = parseEther("10000");
    beforeEach(async function () {
        await expect(
            lensHub.connect(governance).whitelistFollowModule(tokenGatedFollowModule.address, true)
        ).to.not.be.reverted;
    });

    context('Negatives', function () {
        context('Initialization', function () {
            it('User should fail to create a profile with Token Gated Follow Module using zero address as the currency', async function () {
                const followModuleData = abiCoder.encode(
                    ['address', 'uint256'],
                    [ZERO_ADDRESS, TOKENS_NEEDED]
                );
                await expect(
                    lensHub.createProfile({
                        to: userAddress,
                        handle: MOCK_PROFILE_HANDLE,
                        imageURI: MOCK_PROFILE_URI,
                        followModule: tokenGatedFollowModule.address,
                        followModuleData: followModuleData,
                        followNFTURI: MOCK_FOLLOW_NFT_URI,
                    })
                ).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
            })
            it('User should fail to create a profile with Token Gated Follow Module with a min. requirement of 0 tokens', async function () {
                const followModuleData = abiCoder.encode(
                    ['address', 'uint256'],
                    [currency.address, 0]
                );
                await expect(
                    lensHub.createProfile({
                        to: userAddress,
                        handle: MOCK_PROFILE_HANDLE,
                        imageURI: MOCK_PROFILE_URI,
                        followModule: tokenGatedFollowModule.address,
                        followModuleData: followModuleData,
                        followNFTURI: MOCK_FOLLOW_NFT_URI,
                    })
                ).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
            });
        });
        context('Following', function () {
            beforeEach(async function () {
                const followModuleData = abiCoder.encode(
                    ['address', 'uint256'],
                    [currency.address, TOKENS_NEEDED]
                );
                await expect(
                    lensHub.createProfile({
                        to: userAddress,
                        handle: MOCK_PROFILE_HANDLE,
                        imageURI: MOCK_PROFILE_URI,
                        followModule: tokenGatedFollowModule.address,
                        followModuleData: followModuleData,
                        followNFTURI: MOCK_FOLLOW_NFT_URI,
                    })
                ).to.not.be.reverted;
            });

            it('UserTwo should fail to follow with a token balance less than the minimum', async function () {
                const followModuleData = abiCoder.encode(
                    ['address', 'uint256'],
                    [currency.address, TOKENS_NEEDED]
                );
                await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [followModuleData])).to.be.revertedWith(ERRORS.NOT_ENOUGH_TOKENS);
            });
        });
    })

    context('Scenarios', function () {
        it('User should create a profile with the Token Gated Follow Module as the follow module and data, correct events should be emitted', async function () {
            const followModuleData = abiCoder.encode(
                ['address', 'uint256'],
                [currency.address, TOKENS_NEEDED]
            );
            const tx = lensHub.createProfile({
                to: userAddress,
                handle: MOCK_PROFILE_HANDLE,
                imageURI: MOCK_PROFILE_URI,
                followModule: tokenGatedFollowModule.address,
                followModuleData: followModuleData,
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
                tokenGatedFollowModule.address,
                followModuleData,
                MOCK_FOLLOW_NFT_URI,
                await getTimestamp(),
            ]);
        });

        it('User should create a profile then set the Token Gated Follow Module as the follow module with data, correct events should be emitted', async function () {
            await expect(
                lensHub.createProfile({
                    to: userAddress,
                    handle: MOCK_PROFILE_HANDLE,
                    imageURI: MOCK_PROFILE_URI,
                    followModule: ZERO_ADDRESS,
                    followModuleData: [],
                    followNFTURI: MOCK_FOLLOW_NFT_URI,
                })
            ).to.not.be.reverted;

            const followModuleData = abiCoder.encode(
                ['address', 'uint256'],
                [currency.address, TOKENS_NEEDED]
            );
            const tx = lensHub.setFollowModule(
                FIRST_PROFILE_ID,
                tokenGatedFollowModule.address,
                followModuleData
            );

            const receipt = await waitForTx(tx);

            expect(receipt.logs.length).to.eq(1);
            matchEvent(receipt, 'FollowModuleSet', [
                FIRST_PROFILE_ID,
                tokenGatedFollowModule.address,
                followModuleData,
                await getTimestamp(),
            ]);
        });

        it('User should create a profile with the Token Gated Follow Module as the follow module and data, fetched profile data should be accurate', async function () {
            const followModuleData = abiCoder.encode(
                ['address', 'uint256'],
                [currency.address, TOKENS_NEEDED]
            );
            await expect(
                lensHub.createProfile({
                    to: userAddress,
                    handle: MOCK_PROFILE_HANDLE,
                    imageURI: MOCK_PROFILE_URI,
                    followModule: tokenGatedFollowModule.address,
                    followModuleData: followModuleData,
                    followNFTURI: MOCK_FOLLOW_NFT_URI,
                })
            ).to.not.be.reverted;

            const fetchedData = await tokenGatedFollowModule.getProfileData(FIRST_PROFILE_ID);
            expect(fetchedData.amount).to.eq(TOKENS_NEEDED);
            expect(fetchedData.currency).to.eq(currency.address);
        });

        it('User should create a profile with the Token Gated Follow Module as the follow module and data, UserTwo follows with a balance larger than the minimum, should not revert', async function () {
            const followModuleData = abiCoder.encode(
                ['address', 'uint256'],
                [currency.address, TOKENS_NEEDED]
            );
            await expect(
                lensHub.createProfile({
                    to: userAddress,
                    handle: MOCK_PROFILE_HANDLE,
                    imageURI: MOCK_PROFILE_URI,
                    followModule: tokenGatedFollowModule.address,
                    followModuleData: followModuleData,
                    followNFTURI: MOCK_FOLLOW_NFT_URI,
                })
            ).to.not.be.reverted;

            await expect(currency.mint(userTwoAddress, parseEther("10001"))).to.not.be.reverted;
            await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [followModuleData])).to.not.be.reverted;
        });
        it('User should create a profile with the token gated follow module as the follow module and data, UserTwo follows with the minimum balance, should not revert', async function () {
            const followModuleData = abiCoder.encode(
                ['address', 'uint256'],
                [currency.address, TOKENS_NEEDED]
            );
            await expect(
                lensHub.createProfile({
                    to: userAddress,
                    handle: MOCK_PROFILE_HANDLE,
                    imageURI: MOCK_PROFILE_URI,
                    followModule: tokenGatedFollowModule.address,
                    followModuleData: followModuleData,
                    followNFTURI: MOCK_FOLLOW_NFT_URI,
                })
            ).to.not.be.reverted;

            await expect(currency.mint(userTwoAddress, parseEther("10000"))).to.not.be.reverted;
            await expect(lensHub.connect(userTwo).follow([FIRST_PROFILE_ID], [followModuleData])).to.not.be.reverted;
        });

    });
});
