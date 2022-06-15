```                                                                                                                       
     &&&&&                        &&&&&&&&&&&&&&&&&&&&&&&&     &&&&&&&&&&              &&&&&         /&&&&&&&&&&&&&&&&&           
     &&&&&                        &&&&&&&&&&&&&&&&&&&&&&&&     &&&&  &&&&&             &&&&&       &&&&&&(        .&&&&&&*        
     &&&&&                        &&&&&                        &&&&   &&&&&            &&&&&      &&&&/               &&&&&       
     &&&&&                        &&&&&                        &&&&    &&&&&           &&&&&     &&&&&                 &&&&,      
     &&&&&                        &&&&&                        &&&&     &&&&&          &&&&&     &&&&&                 &&&&&      
     &&&&&                        &&&&&                        &&&&      &&&&&         &&&&&      &&&&&&                          
     &&&&&                        &&&&&                        &&&&       &&&&%        &&&&&        &&&&&&&&&&&                   
     &&&&&                        &&&&&&&&&&&&&&&&&&&&         &&&&        &&&&/       &&&&&             &&&&&&&&&&&&&&           
     &&&&&                        &&&&&                        &&&&         &&&&*      &&&&&                     ,&&&&&&&&        
     &&&&&                        &&&&&                        &&&&          &&&&      &&&&&                          (&&&&&      
     &&&&&                        &&&&&                        &&&&           &&&&     &&&&&    &&&&&                   &&&&      
     &&&&&                        &&&&&                        &&&&            &&&&    &&&&&     &&&&                   &&&&      
     &&&&&                        &&&&&                        &&&&            *&&&&   &&&&&     /&&&&&                &&&&&      
     &&&&&&&&&&&&&&&&&&&&&&&&&    &&&&&&&&&&&&&&&&&&&&&&&&     &&&&             (&&&&  &&&&&       &&&&&&&         &&&&&&&        
     &&&&&&&&&&&&&&&&&&&&&&&&&    &&&&&&&&&&&&&&&&&&&&&&&&     &&&&              %&&&&&&&&&&          &&&&&&&&&&&&&&&&&,          
                                                                                                                                  
                                                                                                                                  
                                                                                                                                  

                  _( )_      _                  wWWWw   _                        _( )_      _                  wWWWw   _       
      @@@@       (_   _)    ( )     _     @@@@  (___) _( )_          @@@@       (_   _)    ( )     _     @@@@  (___) _( )_     
     @@()@@ wWWWw  (_)\     ( )   _( )_  @@()@@   Y  (_   _)        @@()@@ wWWWw  (_)\     ( )   _( )_  @@()@@   Y  (_   _)    
      @@@@  (___)      |/   ( )  (_____)  @@@@   \|/   (_)\          @@@@  (___)      |/   ( )  (_____)  @@@@   \|/   (_)\      
       /      Y       \|    (_)     |     \|      |/       |          /      Y       \|    (_)     |     \|      |/      |     
    \ |      \|/       | / \ | /   \|/      |/    \       \|/      \ |      \|/       | / \ | /   \|/      |/    \       \|/   
      |       |        |     |      |       |     |        |         |       |        |     |      |       |     |        |    
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   _//|\_     |        |\ _//|\_   /|\      |\_   |\___    |\     _//|\_     |        |\ _//|\_   /|\      |\_   |\___    |\   
      | \_/  / \__    / \_   |        \   _/      |       _|         | \_/  / \__    / \_   |        \   _/      |       _|    
     /|\_  _/       _/\       \__     /\_        / \_      |_       /|\_  _/       _/\       \__     /\_        / \_      |_    
    / |     |        \___      \_     /\         \        /        / |     |        \___      \_     /\         \        /                         

```

# Lens Protocol

The Lens Protocol is a decentralized, non-custodial social graph. Lens implements unique, on-chain social interaction mechanisms analogous to commonly understood Web2 social media interactions, but significantly expanded with unique functionality that empower communities to form and participants to own their own social graph.

## Setup

> For now only Linux and macOS are known to work
>
> We are now figuring out what works for Windows, instructions will be updated soon
>
> (feel free to experiment and submit PR's)

The environment is built using Docker Compose, note that your `.env` file must have the RPC URL of the network you want to use, and an optional `MNEMONIC` and `BLOCK_EXPLORER_KEY`, defined like so, assuming you choose to use Mumbai network:

```
MNEMONIC="MNEMONIC YOU WANT TO DERIVE WALLETS FROM HERE"
MUMBAI_RPC_URL="YOUR RPC URL HERE"
BLOCK_EXPLORER_KEY="YOUR BLOCK EXPLORER API KEY HERE"
```

With the environment file set up, you can move on to using Docker:

```bash
export USERID=$UID && docker-compose build && docker-compose run --name lens contracts-env bash
```

If you need additional terminals:

```bash
docker exec -it lens bash
```

From there, have fun!

Here are a few self-explanatory scripts:

```bash
npm run test
npm run coverage
npm run compile
```

Cleanup leftover Docker containers:

```bash
USERID=$UID docker-compose down
```

### Foundry Setup

We also support writing tests in Solidity via [Foundry](https://github.com/foundry-rs/foundry).

1. For now, this requires NPM packages to be installed locally. Therefore you must have NodeJS 16 installed and run: `npm install`.
2. Install Foundry as per the installation instructions here: https://getfoundry.sh/
3. You can now run tests with: `forge test`.

**Local deployment steps are a work-in-progress with Foundry.**

## Protocol Overview

The Lens Protocol transfers ownership of social graphs to the participants of that graph themselves. This is achieved by creating direct links between `profiles` and their `followers`, while allowing fine-grained control of additional logic, including monetization, to be executed during those interactions on a profile-by-profile basis.

Here's how it works...

### Profiles

Any address can create a profile and receive an ERC-721 `Lens Profile` NFT. Profiles are represented by a `ProfileStruct`:

```
/**
 * @notice A struct containing profile data.
 *
 * @param pubCount The number of publications made to this profile.
 * @param followNFT The address of the followNFT associated with this profile, can be empty..
 * @param followModule The address of the current follow module in use by this profile, can be empty.
 * @param handle The profile's associated handle.
 * @param uri The URI to be displayed for the profile NFT.
 */
struct ProfileStruct {
    uint256 pubCount;
    address followNFT;
    address followModule;
    string handle;
    string uri;
}
```

Profiles have a specific URI associated with them, which is meant to include metadata, such as a link to a profile picture or a display name for instance, the JSON standard for this URI is not yet determined. Profile owners can always change their follow module or profile URI.

#### Publications

Profile owners can `publish` to any profile they own. There are three `publication` types: `Post`, `Comment` and `Mirror`. Profile owners can also set and initialize the `Follow Module` associated with their profile.

Publications are on-chain content created and published via profiles. Profile owners can create (publish) three publication types, outlined below. They are represented by a `PublicationStruct`:

```
/**
 * @notice A struct containing data associated with each new publication.
 *
 * @param profileIdPointed The profile token ID this publication points to, for mirrors and comments.
 * @param pubIdPointed The publication ID this publication points to, for mirrors and comments.
 * @param contentURI The URI associated with this publication.
 * @param referenceModule The address of the current reference module in use by this profile, can be empty.
 * @param collectModule The address of the collect module associated with this publication, this exists for all publication.
 * @param collectNFT The address of the collectNFT associated with this publication, if any.
 */
struct PublicationStruct {
    uint256 profileIdPointed;
    uint256 pubIdPointed;
    string contentURI;
    address referenceModule;
    address collectModule;
    address collectNFT;
}
```

#### Publication Types

##### Post

This is the standard publication type, akin to a regular post on traditional social media platforms. Posts contain:

1. A URI, pointing to the actual publication body's metadata JSON, including any images or text.
2. An uninitialized pointer, since pointers are only needed in mirrors and comments.

##### Comment

This is a publication type that points back to another publication, whether it be a post, comment or mirror, akin to a regular comment on traditional social media. Comments contain:

1. A URI, just like posts, pointing to the publication body's metadata JSON.
2. An initialized pointer, containing the profile ID and the publication ID of the publication commented on.

##### Mirror

This is a publication type that points to another publication, note that mirrors cannot, themselves, be mirrored (doing so instead mirrors the pointed content). Mirrors have no original content of its own. Akin to a "share" on traditional social media. Mirrors contain:

1. An empty URI, since they cannot have content associated with them.
2. An initialized pointer, containing the profile ID and the publication ID of the mirrored publication.

### Profile Interaction

There are two types of profile interactions: follows and collects.

#### Follows

Wallets can follow profiles, executing modular follow processing logic (in that profile's selected follow module) and receiving a `Follow NFT`. Each profile has a connected, unique `FollowNFT` contract, which is first deployed upon successful follow. Follow NFTs are NFTs with integrated voting and delegation capability.

The inclusion of voting and delegation right off the bat means that follow NFTs have the built-in capability to create a spontaneous DAO around any profile. Furthermore, holding follow NFTs allows followers to `collect` publications from the profile they are following (except mirrors, which are equivalent to shares in Web2 social media, and require following the original publishing profile to collect).

#### Collects

Collecting works in a modular fashion as well, every publication (except mirrors) requires a `Collect Module` to be selected and initialized. This module, similarly to follow modules, can contain any arbitrary logic to be executed upon collects. Successful collects result in a new, unique NFT being minted, essentially as a saved copy of the original publication. There is one deployed collect NFT contract per publication, and it's deployed upon the first successful collect.

When a mirror is collected, what happens behind the scenes is the original, mirrored publication is collected, and the mirror publisher's profile ID is passed as a "referrer." This allows neat functionality where collect modules that incur a fee can, for instance, reward referrals. Note that the `Collected` event, which is emitted upon collection, indexes the profile and publication directly being passed, which, in case of a mirror, is different than the actual original publication getting collected (which is emitted unindexed).

Alright, that was a mouthful! Let's move on to more specific details about Lens's core principle: Modularity.

## Lens Modularity

Stepping back for a moment, the core concept behind modules is to allow as much freedom as possible to the community to come up with new, innovative interaction mechanisms between social graph participants. For security purposes, this is achieved by including a whitelisted list of modules controlled by governance.

To recap, the Lens Protocol has three types of modules:

1. `Follow Modules` contain custom logic to be executed upon follow.
2. `Collect Modules` contain custom logic to be executed upon collect. Typically, these modules include at least a check that the collector is a follower.
3. `Reference Modules` contain custom logic to be executed upon comment and mirror. These modules can be used to limit who is able to comment and interact with a profile.

Note that collect and reference modules should _not_ assume that a publication cannot be re-initialized, and thus should include front-running protection as a security measure if needed, as if the publication data was not static. This is even more prominent in follow modules, where it can absolutely be changed for a given profile.

Lastly, there is also a `ModuleGlobals` contract which acts as a central data provider for modules. It is controlled by a specific governance address which can be set to a different executor compared to the Hub's governance. It's expected that modules will fetch dynamically changing data, such as the module globals governance address, the treasury address, the treasury fee as well as a list of whitelisted currencies.

### Upgradeability

This iteration of the Lens Protocol implements a transparent upgradeable proxy for the central hub to be controlled by governance. There are no other aspects of the protocol that are upgradeable. In an ideal world, the hub will not require upgrades due to the system's inherent modularity and openness, upgradeability is there only to implement new, breaking changes that would be impossible, or unreasonable to implement otherwise.

This does come with a few caveats, for instance, the `ModuleGlobals` contract implements a currency whitelist, but it is not upgradeable, so the "removal" of a currency whitelist in a module would require a specific new module that does not query the `ModuleGlobals` contract for whitelisted currencies.
