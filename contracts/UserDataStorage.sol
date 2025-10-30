// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract UserDataStorage {
    struct UserData {
        string encryptedFirstName;
        string encryptedLastName;
        string encryptedBirthdate;
        string encryptedGender;
        string encryptedLocation;
        string encryptedID;
        string encryptedTraits;
        string encryptedMBTI;
        string arweaveTxId;
        uint256 lastUpdate;
        uint256 interactionCount;
        bool isVerified;
        bool isRegistered;
    }

    struct UserInput {
        string encryptedFirstName;
        string encryptedLastName;
        string encryptedBirthdate;
        string encryptedGender;
        string encryptedLocation;
        string encryptedID;
        string encryptedTraits;
        string encryptedMBTI;
        string arweaveTxId;
    }

    mapping(address => UserData) public userData;

    event DataUpdated(address indexed user, uint256 timestamp);
    event SignedIn(address indexed user, uint256 timestamp);

    function updateData(UserInput memory input) public {
        UserData storage user = userData[msg.sender];
        if (!user.isRegistered) {
            user.encryptedFirstName = input.encryptedFirstName;
            user.encryptedLastName = input.encryptedLastName;
            user.encryptedBirthdate = input.encryptedBirthdate;
            user.encryptedGender = input.encryptedGender;
            user.encryptedLocation = input.encryptedLocation;
            user.encryptedMBTI = input.encryptedMBTI;
            user.isRegistered = true;
        }
        if (bytes(input.encryptedID).length > 0) {
            user.encryptedID = input.encryptedID;
            user.isVerified = true;
        }
        user.encryptedTraits = input.encryptedTraits;
        if (bytes(input.arweaveTxId).length > 0) {
            user.arweaveTxId = input.arweaveTxId;
        }
        user.lastUpdate = block.timestamp;
        user.interactionCount += 1;
        emit DataUpdated(msg.sender, block.timestamp);
    }

    function signIn() public {
        require(userData[msg.sender].isRegistered, "User not registered");
        userData[msg.sender].lastUpdate = block.timestamp;
        userData[msg.sender].interactionCount += 1;
        emit SignedIn(msg.sender, block.timestamp);
    }

    function isUserRegistered(address _user) public view returns (bool) {
        return userData[_user].isRegistered;
    }
}