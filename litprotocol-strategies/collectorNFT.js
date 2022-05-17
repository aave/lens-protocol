const collectorNFTAccessControl = [
  {
    contractAddress: 'ADDRESS',
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
