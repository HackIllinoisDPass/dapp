pragma solidity ^0.4.19;

contract LocationContractv2{
  event LocationRecorded(address indexed _sender, address indexed _signer, string loc, string time, string encData);

  function addLocation(address signer, string location, string time, string encData) public{
    LocationRecorded(msg.sender, signer, location, time, encData);
  }
}
