// Example = 0xe3cfaA117Fc276B111ddB886aFDc390CC2269564

const followerNFTAccessControl = [
  {
    contractAddress: '0xe3cfaA117Fc276B111ddB886aFDc390CC2269564',
    standardContractType: 'ERC721',
    chain,
    method: 'balanceOf',
    parameters: [
      ':owner',
    ],
    returnValueTest: {
      comparator: '>',
      value: '0'
    }
  }
]
