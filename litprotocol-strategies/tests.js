const litNodeClient = new LitJsSdk.LitNodeClient()
litNodeClient.connect()
const chain = 'polygon'

const provisionAndSign = async (accessControlConditions) => {

  let authSig = JSON.parse("{\"sig\":\"0x18a173d68d2f78cc5c13da0dfe36eec2a293285bee6d42547b9577bf26cdc985660ed3dddc4e75d422366cac07e8a9fc77669b10373bef9c7b8e4280252dfddf1b\",\"derivedVia\":\"web3.eth.personal.sign\",\"signedMessage\":\"I am creating an account to use LITs at 2021-08-04T20:14:04.918Z\",\"address\":\"0xdbd360f30097fb6d938dcc8b7b62854b36160b45\"}")


  let resourceId = {
    baseUrl: 'https://my-dynamic-content-server.com',
    path: randomUrlPath(),
    orgId: ""
  }

  await litNodeClient.saveSigningCondition({
    accessControlConditions,
    chain,
    authSig,
    resourceId
  })


  let jwt = await litNodeClient.getSignedToken({
    accessControlConditions,
    chain,
    authSig,
    resourceId
  })

  console.log(jwt)

  if (jwt) {
    return true
  }
  return false
}


const accessControlConditions = [
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

const runTests = async () => {
  const res = await provisionAndSign(accessControlConditions[0])
  if(res == false) {
    console.log('Error on access control conditions: ', accessControlConditions[0]);
    process.exit(1)
  }
}

runTests()
