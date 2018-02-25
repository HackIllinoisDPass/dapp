var Qtum = require("qtumjs");

const repoData = require("./solar.development.json");
const qtum = new Qtum.Qtum("http://qtum:test@localhost:3889", repoData);

const myToken = qtum.contract("Locationv2");


myToken.onLog((entry) => {
    console.log(entry.event);
}, { minconf: 1, fromBlock:92919 });