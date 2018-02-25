const qtumWallet = require('qtumjs-wallet')
const qtumjs = require('qtumjs')
const express = require('express')
const app = express()
const http = require('http')
const port = 3000
const network = qtumWallet.networks.testnet
var bodyParser = require('body-parser')
var jsonParser = bodyParser.json()


const sourceWallets = [
  "cQDNBwu7P4BKGJX2wnXHg3k9eTMNQk4DsnVrHFpUNaXL6u88akVA",
  "cSfxuNsSG6FnqiqhUUJpUGhfPXfJiX2bbpoGGVbiVzcZRvh1F9Vm",
  "cSgvrs8t1McFYhzFRWQafmsY6hzqRdR9hZjWXgfMkXrGa81Fdgvg",
  "cVtKgpzWE3sYCD8KFubuZ4oH5QofsKTXob8LSE6wLsK5fSnjwasZ",
  "cUmTM3RrkgMRqc8HaS9zkpjqLjv7jJuAf2zzj9zZyoDZjDpoNvVB",
  "cTyaUJ45PTgHrWd66VRahzTK3mHjv4Jwxtp1JBDb98PyveS2Npts",
  "cRac3cD9L8RSq2Eds6rpHT4trV7dQrKC3soRwK8tfKvLZJu9kNoD",
  "cPzRNu9Gfijy94gQw15mywwowJ7CovRG3AqNzoZ6XKPE5AwmQBuw"
]

var events = []

const repoData = require("./solar.development.json");
const qtum = new qtumjs.Qtum("http://qtum:test@localhost:3889", repoData);
const rpc = new qtumjs.QtumRPC("http://qtum:test@localhost:3889")
// rpc.rawCall("importprivkey", ["cQDNBwu7P4BKGJX2wnXHg3k9eTMNQk4DsnVrHFpUNaXL6u88akVA", "cQDNBwu7P4BKGJX2wnXHg3k9eTMNQk4DsnVrHFpUNaXL6u88akVA", false]).then(() =>{
//   console.log("import completed");
// });

const myToken = qtum.contract("Locationv2");



myToken.onLog((entry) => {
    console.log(entry.event);
    events.push(entry.event);
}, { minconf: 1, fromBlock:93177 });

app.get('/createwallet', (req, res) => {
  res.statusCode = 200;
  createWallet().then((result) => {
    console.log(result)
    res.send(result)
  })
})

app.get('/getinfo/:privatekey', (req, res) => {
  res.statusCode = 200;
  getUserWalletInfo(req.params.privatekey).then((result) => {
    res.send(result)
  })
})

app.get('/checksource', (req, res) => {
  res.statusCode = 200;
  getSourceWallet().then((result) => {
    result.getInfo().then((result) => {
      res.send(result)
    })
  })
})

app.get('/getevents', (req, res) => {
  var address = req.query.address;
  var sender = req.query.sender == "true";
  console.log("address " + address + " sender " + sender);
  filterEvents(address, sender).then((result) => {
    var jsonString = JSON.stringify({events: result});
    console.log(jsonString);
    res.send(jsonString);
  })
});

app.post('/fillcontract', jsonParser, (req, res) => {
  var sender = req.body.sender;
  var params = {signer: req.body.signer, location: req.body.location, time: req.body.time, encData: req.body.encData}
  console.log(req.body)

  var publicSender;
  res.sendStatus(200)
  rpc.rawCall("importprivkey", [sender, sender, true]).then(() =>{
    console.log("import completed");
    sendAfterImport(sender, params).then((result) => {
      console.log("Add location completed");
    });
  });
})

app.listen(port, () => console.log("Starting on port " + port))

async function createWallet() {
  const mnemonic = qtumWallet.generateMnemonic()
  const password = "covfefe"

  const wallet = await network.fromMnemonic(mnemonic, password)
  let tx = await fundWallet(wallet, 1)
  console.log(tx)

  let privatekey = await wallet.toWIF()

  return {"publicKey": wallet.address, "privateKey": privatekey}
}

async function getUserWalletInfo(privatekey){
  let userWallet = await network.fromWIF(privatekey)
  fundWalletBelowThreshold(userWallet)

  return userWallet.getInfo()
}

async function getSourceWallet(){
  let privatekey
  let sourceWallet
  let balance = 0

  let i = 0
  do{
    privatekey = sourceWallets[i++]
    sourceWallet = await network.fromWIF(privatekey)
    if(sourceWallet === undefined){
      continue
    }
    balance = (await sourceWallet.getInfo())[0].amount
  } while(balance < 0.15 && i <= sourceWallets.length)
  
  return sourceWallet
}

async function fundWallet(destWallet, amount){
  let sourceWallet = await getSourceWallet()

  console.log("\n" + sourceWallet.address)

  const toAddr = destWallet.address
  const sendTx = await sourceWallet.send(toAddr, amount, .001)

  return sendTx
}

//Use this for a smart contract to check if they have enough money, (blocking call for smart)
async function fundWalletBelowThreshold(userWallet){
  let walletAmount = (await userWallet.getInfo())[0].satoshis
  console.log(walletAmount)
  if(walletAmount < 1000000){
    let tx = await fundWallet(userWallet, 0.1)
  }
}

async function sendAfterImport(sender, params){
  let wallet = await network.fromWIF(sender);
  var utxos = await wallet.getUTXOs()
  var publicSender = utxos[0].address;
  console.log(utxos);
  console.log(publicSender);
  return addLocation(publicSender, params);
}

async function addLocation(sender, props){
  var hashedSigner = await rpc.rawCall("gethexaddress", [props.signer]);
  const tx = await myToken.send("addLocation", [hashedSigner, props.location, props.time, props.encData], {senderAddress: sender});

  console.log("tx:", tx)

  const receipt = await tx.confirm(3, (updatedTx) => {
    console.log("new confirmation", updatedTx.txid, updatedTx.confirmations)
  })
  console.log("tx receipt:", JSON.stringify(receipt, null, 2))
}

async function filterEvents(address, sender){
  var elements = [];
  var result = await rpc.rawCall("gethexaddress", [address]);
  console.log("result from gethexaddress " + result);
  if(sender){
    console.log("sender true");
    console.log(events.filter(element => element._sender === result))
    elements = events.filter(element => element._sender === result);
  }else{
    console.log("sender false");
    console.log(events.filter(element => element._signer === result))
    elements = events.filter(element => element._signer === result);
  }
  return elements;
}