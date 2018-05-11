// Abstract storage contract
let AbstractStorage = artifacts.require('./RegistryStorage')
// MintedCappedCrowdsale
let InitMintedCapped = artifacts.require('./InitCrowdsale')
// let MintedCappedBuy = artifacts.require('./CrowdsaleBuyTokens')
let MintedCappedCrowdsaleConsole = artifacts.require('./CrowdsaleConsole')
let MintedCappedTokenConsole = artifacts.require('./TokenConsole')
let MintedCappedTokenTransfer = artifacts.require('./TokenTransfer')
let MintedCappedTokenTransferFrom = artifacts.require('./TokenTransferFrom')
let MintedCappedTokenApprove = artifacts.require('./TokenApprove')
// Utils
let TestUtils = artifacts.require('./RegistryUtils')
let TokenConsoleUtils = artifacts.require('./TokenConsoleUtils')
let CrowdsaleConsoleUtils = artifacts.require('./CrowdsaleConsoleUtils')
let BuyTokensUtil = artifacts.require('./BuyTokensUtil')
// Mock
let CrowdsaleBuyTokensMock = artifacts.require('./CrowdsaleBuyTokensMock')

function getTime() {
  let block = web3.eth.getBlock('latest')
  return block.timestamp;
}

function zeroAddress() {
  return web3.toHex(0)
}

function hexStrEquals(hex, expected) {
  return web3.toAscii(hex).substring(0, expected.length) == expected;
}

contract('#MintedCappedBuyTokens', function (accounts) {

  let storage
  let testUtils
  let tokenConsoleUtil
  let buyTokensUtil

  let crowdsaleConsoleUtil

  let execAddr = accounts[0]
  let updater = accounts[1]
  let crowdsaleAdmin = accounts[2]

  let teamWallet = accounts[3]
  let teamWalletInitBalance
  let execInitBalance

  let initCrowdsale
  let crowdsaleBuyMock
  let crowdsaleConsole
  let tokenConsole
  let tokenTransfer
  let tokenTransferFrom
  let tokenApprove

  let executionID
  let adminContext

  let initCalldata
  let startTime
  let initialTierName = 'Initial Tier'
  let initialTierPrice = 1 // 1 wei per 1 token
  let initialTierDuration = 3600 // 1 hour
  let initialTierTokenSellCap = 1000000 // 1 million tokens for sale in first tier
  let initialTierIsWhitelisted = true
  let initialTierDurIsModifiable = true

  let tokenName = 'Token'
  let tokenSymbol = 'TOK'
  let tokenDecimals = 0

  let buyCalldata
  let buyEvent

  let purchaserList = [
    accounts[accounts.length - 1],
    accounts[accounts.length - 2],
    accounts[accounts.length - 3]
  ]
  let p1Context
  let p2Context
  let p3Context

  let tierNames = ['Tier 1', 'Tier 2', 'Tier 3']
  let tierDurations = [10000, 20000, 30000]
  let tierPrices = [10, 100, 1000] // 10, 100, and 1000 wei per 1 token
  let tierCaps = [100000, 10000, 1000] // 100000, 10000, and 1000 tokens for sale
  let tierModStats = [true, true, true] // All tier durations are modifiable
  let tierWhitelistStats = [true, false, true] // Only Tier 0 and Tier 2 are not whitelisted

  before(async () => {
    storage = await AbstractStorage.new().should.be.fulfilled
    testUtils = await TestUtils.new().should.be.fulfilled
    tokenConsoleUtil = await TokenConsoleUtils.new().should.be.fulfilled
    buyTokensUtil = await BuyTokensUtil.new().should.be.fulfilled

    crowdsaleConsoleUtil = await CrowdsaleConsoleUtils.new().should.be.fulfilled

    initCrowdsale = await InitMintedCapped.new().should.be.fulfilled
    crowdsaleBuyMock = await CrowdsaleBuyTokensMock.new().should.be.fulfilled
    crowdsaleConsole = await MintedCappedCrowdsaleConsole.new().should.be.fulfilled
    tokenConsole = await MintedCappedTokenConsole.new().should.be.fulfilled
    tokenTransfer = await MintedCappedTokenTransfer.new().should.be.fulfilled
    tokenTransferFrom = await MintedCappedTokenTransferFrom.new().should.be.fulfilled
    tokenApprove = await MintedCappedTokenApprove.new().should.be.fulfilled
  })

  beforeEach(async () => {
    startTime = getTime() + 3600
    teamWalletInitBalance = web3.eth.getBalance(teamWallet).toNumber()
    execInitBalance = web3.eth.getBalance(execAddr).toNumber()

    initCalldata = await testUtils.init(
      teamWallet, startTime, initialTierName, initialTierPrice,
      initialTierDuration, initialTierTokenSellCap, initialTierIsWhitelisted,
      initialTierDurIsModifiable, crowdsaleAdmin
    ).should.be.fulfilled
    initCalldata.should.not.eq('0x')

    let events = await storage.initAndFinalize(
      updater, true, initCrowdsale.address, initCalldata, [
        crowdsaleBuyMock.address, crowdsaleConsole.address, tokenConsole.address,
        tokenTransfer.address, tokenTransferFrom.address, tokenApprove.address
      ],
      { from: execAddr }
    ).then((tx) => {
      return tx.logs
    })
    events.should.not.eq(null)
    events.length.should.be.eq(2)

    events[0].event.should.be.eq('ApplicationInitialized')
    events[1].event.should.be.eq('ApplicationFinalization')
    executionID = events[0].args['execution_id']
    web3.toDecimal(executionID).should.not.eq(0)

    adminContext = await testUtils.getContext(
      executionID, crowdsaleAdmin, 0
    ).should.be.fulfilled
    adminContext.should.not.eq('0x')

    await crowdsaleBuyMock.resetTime().should.be.fulfilled
    let storedTime = await crowdsaleBuyMock.set_time().should.be.fulfilled
    storedTime.toNumber().should.be.eq(0)

    let initTokenCalldata = await crowdsaleConsoleUtil.initCrowdsaleToken(
      tokenName, tokenSymbol, tokenDecimals, adminContext
    ).should.be.fulfilled
    initTokenCalldata.should.not.eq('0x')

    events = await storage.exec(
      crowdsaleConsole.address, executionID, initTokenCalldata,
      { from: execAddr }
    ).then((tx) => {
      return tx.logs
    })
    events.should.not.eq(null)
    events.length.should.be.eq(1)
    events[0].event.should.be.eq('ApplicationExecution')
  })

  // describe('pre-test-storage', async() => {
  //
  //   it('should be an uninitialized crowdsale', async () => {
  //     let saleInfo = await initCrowdsale.getCrowdsaleInfo(
  //       storage.address, executionID
  //     ).should.be.fulfilled
  //     saleInfo.length.should.be.eq(5)
  //
  //     saleInfo[0].toNumber().should.be.eq(0)
  //     saleInfo[1].should.be.eq(teamWallet)
  //     saleInfo[2].toNumber().should.be.eq(0)
  //     saleInfo[3].should.be.eq(false)
  //     saleInfo[4].should.be.eq(false)
  //   })
  //
  //   it('should have a correctly initialized token', async () => {
  //     let tokenInfo = await initCrowdsale.getTokenInfo(
  //       storage.address, executionID
  //     ).should.be.fulfilled
  //     tokenInfo.length.should.be.eq(4)
  //
  //     hexStrEquals(tokenInfo[0], tokenName).should.be.eq(true)
  //     hexStrEquals(tokenInfo[1], tokenSymbol).should.be.eq(true)
  //     tokenInfo[2].toNumber().should.be.eq(0)
  //     tokenInfo[3].toNumber().should.be.eq(0)
  //   })
  // })
  //
  // describe('no wei sent', async () => {
  //
  //   let invalidCalldata
  //   let invalidEvent
  //
  //   let invalidContext
  //
  //   beforeEach(async () => {
  //     invalidContext = await testUtils.getContext(
  //       executionID, purchaserList[0], 0
  //     ).should.be.fulfilled
  //     invalidContext.should.not.eq('0x')
  //
  //     let initCrowdsaleCalldata = await crowdsaleConsoleUtil.initializeCrowdsale(
  //       adminContext
  //     ).should.be.fulfilled
  //     initCrowdsaleCalldata.should.not.eq('0x')
  //
  //     invalidCalldata = await buyTokensUtil.buy(
  //       invalidContext
  //     ).should.be.fulfilled
  //     invalidCalldata.should.not.eq('0x')
  //
  //     let events = await storage.exec(
  //       crowdsaleConsole.address, executionID, initCrowdsaleCalldata,
  //       { from: execAddr }
  //     ).then((tx) => {
  //       return tx.logs
  //     })
  //     events.should.not.eq(null)
  //     events.length.should.be.eq(1)
  //     events[0].event.should.be.eq('ApplicationExecution')
  //
  //     events = await storage.exec(
  //       crowdsaleBuyMock.address, executionID, invalidCalldata,
  //       { from: execAddr }
  //     ).then((tx) => {
  //       return tx.logs
  //     })
  //     events.should.not.eq(null)
  //     events.length.should.be.eq(1)
  //     invalidEvent = events[0]
  //   })
  //
  //   it('should emit an ApplicationException event', async () => {
  //     invalidEvent.event.should.be.eq('ApplicationException')
  //   })
  //
  //   describe('the ApplicationException event', async () => {
  //
  //     it('should match the used execution id', async () => {
  //       let emittedExecID = invalidEvent.args['execution_id']
  //       emittedExecID.should.be.eq(executionID)
  //     })
  //
  //     it('should match the BuyTokensMock address', async () => {
  //       let emittedAppAddr = invalidEvent.args['application_address']
  //       emittedAppAddr.should.be.eq(crowdsaleBuyMock.address)
  //     })
  //
  //     it('should contain the error message \'NoWeiSent\'', async () => {
  //       let emittedMessage = invalidEvent.args['message']
  //       hexStrEquals(emittedMessage, 'NoWeiSent').should.be.eq(true)
  //     })
  //   })
  //
  //   describe('the resulting crowdsale storage', async () => {
  //
  //     it('should be an initialized crowdsale', async () => {
  //       let saleInfo = await initCrowdsale.getCrowdsaleInfo(
  //         storage.address, executionID
  //       ).should.be.fulfilled
  //       saleInfo.length.should.be.eq(5)
  //
  //       saleInfo[0].toNumber().should.be.eq(0)
  //       saleInfo[1].should.be.eq(teamWallet)
  //       saleInfo[2].toNumber().should.be.eq(0)
  //       saleInfo[3].should.be.eq(true)
  //       saleInfo[4].should.be.eq(false)
  //     })
  //
  //     it('should have a correctly initialized token', async () => {
  //       let tokenInfo = await initCrowdsale.getTokenInfo(
  //         storage.address, executionID
  //       ).should.be.fulfilled
  //       tokenInfo.length.should.be.eq(4)
  //
  //       hexStrEquals(tokenInfo[0], tokenName).should.be.eq(true)
  //       hexStrEquals(tokenInfo[1], tokenSymbol).should.be.eq(true)
  //       tokenInfo[2].toNumber().should.be.eq(0)
  //       tokenInfo[3].toNumber().should.be.eq(0)
  //     })
  //
  //     it('should have an unchanged team wallet balance', async () => {
  //       let curTeamBalance = web3.eth.getBalance(teamWallet).toNumber()
  //       curTeamBalance.should.be.eq(teamWalletInitBalance)
  //     })
  //   })
  // })

  describe('crowdsale is not initialized', async () => {

    let invalidCalldata
    let invalidEvent

    let valueSent = 1

    beforeEach(async () => {
      let purchaseContext = await testUtils.getContext(
        executionID, purchaserList[0], valueSent
      ).should.be.fulfilled
      purchaseContext.should.not.eq('0x')

      invalidCalldata = await buyTokensUtil.buy(
        purchaseContext
      ).should.be.fulfilled
      invalidCalldata.should.not.eq('0x')

      let events = await storage.exec(
        crowdsaleBuyMock.address, executionID, invalidCalldata,
        { from: execAddr, value: valueSent }
      ).then((tx) => {
        return tx.logs
      })
      events.should.not.eq(null)
      events.length.should.be.eq(1)
      invalidEvent = events[0]
      console.log(web3.toAscii(invalidEvent.args['message']))
    })

    it('should emit an ApplicationException event', async () => {
      invalidEvent.event.should.be.eq('ApplicationException')
    })

    describe('the ApplicationException event', async () => {

      it('should match the used execution id', async () => {
        let emittedExecID = invalidEvent.args['execution_id']
        emittedExecID.should.be.eq(executionID)
      })

      it('should match the BuyTokensMock address', async () => {
        let emittedAppAddr = invalidEvent.args['application_address']
        emittedAppAddr.should.be.eq(crowdsaleBuyMock.address)
      })

      // it('should contain the error message \'NoWeiSent\'', async () => {
      //   let emittedMessage = invalidEvent.args['message']
      //   hexStrEquals(emittedMessage, 'NoWeiSent').should.be.eq(true)
      // })
    })

    // describe('the resulting crowdsale storage', async () => {
    //
    //   it('should be an initialized crowdsale', async () => {
    //     let saleInfo = await initCrowdsale.getCrowdsaleInfo(
    //       storage.address, executionID
    //     ).should.be.fulfilled
    //     saleInfo.length.should.be.eq(5)
    //
    //     saleInfo[0].toNumber().should.be.eq(0)
    //     saleInfo[1].should.be.eq(teamWallet)
    //     saleInfo[2].toNumber().should.be.eq(0)
    //     saleInfo[3].should.be.eq(true)
    //     saleInfo[4].should.be.eq(false)
    //   })
    //
    //   it('should have a correctly initialized token', async () => {
    //     let tokenInfo = await initCrowdsale.getTokenInfo(
    //       storage.address, executionID
    //     ).should.be.fulfilled
    //     tokenInfo.length.should.be.eq(4)
    //
    //     hexStrEquals(tokenInfo[0], tokenName).should.be.eq(true)
    //     hexStrEquals(tokenInfo[1], tokenSymbol).should.be.eq(true)
    //     tokenInfo[2].toNumber().should.be.eq(0)
    //     tokenInfo[3].toNumber().should.be.eq(0)
    //   })
    //
    //   it('should have an unchanged team wallet balance', async () => {
    //     let curTeamBalance = web3.eth.getBalance(teamWallet).toNumber()
    //     curTeamBalance.should.be.eq(teamWalletInitBalance)
    //   })
    // })
  })

  // context('crowdsale is already finalized', async () => {
  //
  //   let invalidCalldata
  //   let invalidEvent
  //
  //   beforeEach(async () => {
  //
  //     let
  //   })
  // })

  describe('crowdsale has not started', async () => {

  })

  describe('crowdsale has already ended', async () => {

    context('current stored tier is beyond tier list range', async () => {

    })

    context('current time is beyond end crowdsale time', async () => {

    })
  })

  describe('tier has sold out', async () => {

  })

  describe('whitelist-enabled-tier', async () => {

    context('sender is not whitelisted', async () => {

    })

    context('sender has contributed before', async () => {

      context('sender is spending over their maximum spend amount', async () => {

      })

      context('sender is not spending over their maximum spend amount', async () => {

      })
    })

    context('sender has not contributed before', async () => {

      context('sender is buying above minimum contribution', async () => {

      })

      context('sender is not buying above minimum contribution', async () => {

      })

      context('sender is spending over their maximum spend amount', async () => {

      })

      context('sender is not spending over their maximum spend amount', async () => {

      })
    })

  })

  describe('non-whitelist-enabled-tier', async () => {

    context('sender has contributed before', async () => {

    })

    context('sender has not contributed before', async () => {

      context('global min cap exists', async () => {

        context('sender is buying above minimum contribution', async () => {

        })

        context('sender is not buying above minimum contribution', async () => {

        })
      })

      context('global min cap does not exist', async () => {

        context('sender is buying above minimum contribution', async () => {

        })

        context('sender is not buying above minimum contribution', async () => {

        })
      })
    })
  })


})
