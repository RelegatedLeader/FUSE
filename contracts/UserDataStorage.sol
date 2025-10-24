// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract UserDataStorage {
    struct UserData {
        string encryptedFirstName;    // Encrypted real first name (immutable core identity)
        string encryptedLastName;     // Encrypted real last name (immutable core identity)
        string[] encryptedEmails;     // Encrypted emails (can add more, for web2-web3 transition)
        string encryptedID;           // Encrypted optional ID (for future verification, heavily secured)
        string encryptedTraits;       // Encrypted personality traits (0-100 scales)
        string encryptedMBTI;         // Encrypted MBTI type (immutable personality core)
        string encryptedFace;         // Encrypted face scan data/hash
        string encryptedBio;          // Encrypted personal bio (up to 200 words, genuine self-description)
        string[] encryptedPosts;      // Encrypted posts/messages in cyberspace (accumulates interactions)
        uint256[] alliances;          // Alliance IDs user is part of (up to 4 free, pay for more)
        uint256 lastUpdate;           // Timestamp of last update
        uint256 interactionCount;     // Number of interactions/updates
        bool isVerified;              // Whether user has verified ID (for moderation)
    }

    mapping(address => UserData) public userData;

    event DataUpdated(address indexed user, uint256 timestamp);
    event PostAdded(address indexed user, uint256 postIndex);
    event AllianceJoined(address indexed user, uint256 allianceId);
    event EmailAdded(address indexed user, uint256 emailIndex);

    // Initial setup/update user core data (called on sign-up/sign-in updates)
    function updateData(
        string memory _encryptedFirstName,
        string memory _encryptedLastName,
        string memory _encryptedID,
        string memory _encryptedTraits,
        string memory _encryptedMBTI,
        string memory _encryptedFace,
        string memory _encryptedBio
    ) public {
        userData[msg.sender].encryptedFirstName = _encryptedFirstName;
        userData[msg.sender].encryptedLastName = _encryptedLastName;
        if (bytes(_encryptedID).length > 0) {
            userData[msg.sender].encryptedID = _encryptedID;
            userData[msg.sender].isVerified = true; // Assuming ID submission verifies
        }
        userData[msg.sender].encryptedTraits = _encryptedTraits;
        userData[msg.sender].encryptedMBTI = _encryptedMBTI;
        userData[msg.sender].encryptedFace = _encryptedFace;
        userData[msg.sender].encryptedBio = _encryptedBio;
        userData[msg.sender].lastUpdate = block.timestamp;
        userData[msg.sender].interactionCount += 1;

        emit DataUpdated(msg.sender, block.timestamp);
    }

    // Add an email (for additional web2 credentials)
    function addEmail(string memory _encryptedEmail) public {
        userData[msg.sender].encryptedEmails.push(_encryptedEmail);
        emit EmailAdded(msg.sender, userData[msg.sender].encryptedEmails.length - 1);
    }

    // Add a post/message to cyberspace (for AI analysis and interactions)
    function addPost(string memory _encryptedPost) public {
        userData[msg.sender].encryptedPosts.push(_encryptedPost);
        emit PostAdded(msg.sender, userData[msg.sender].encryptedPosts.length - 1);
    }

    // Join an alliance (up to 4 free, require payment for more - handled off-chain)
    function joinAlliance(uint256 _allianceId) public {
        // Prevent duplicates
        for (uint256 i = 0; i < userData[msg.sender].alliances.length; i++) {
            if (userData[msg.sender].alliances[i] == _allianceId) return;
        }
        userData[msg.sender].alliances.push(_allianceId);
        emit AllianceJoined(msg.sender, _allianceId);
    }

    // Get identity user data (firstName, lastName, emails, id)
    function getIdentityData(address _user) public view returns (
        string memory,
        string memory,
        string[] memory,
        string memory
    ) {
        return (
            userData[_user].encryptedFirstName,
            userData[_user].encryptedLastName,
            userData[_user].encryptedEmails,
            userData[_user].encryptedID
        );
    }

    // Get personality user data (traits, mbti, face, lastUpdate, interactionCount, isVerified)
    function getPersonalityData(address _user) public view returns (
        string memory,
        string memory,
        string memory,
        uint256,
        uint256,
        bool
    ) {
        return (
            userData[_user].encryptedTraits,
            userData[_user].encryptedMBTI,
            userData[_user].encryptedFace,
            userData[_user].lastUpdate,
            userData[_user].interactionCount,
            userData[_user].isVerified
        );
    }

    // Get extended user data (bio, posts, alliances)
    function getExtendedData(address _user) public view returns (
        string memory,
        string[] memory,
        uint256[] memory
    ) {
        return (
            userData[_user].encryptedBio,
            userData[_user].encryptedPosts,
            userData[_user].alliances
        );
    }

    // Get post count for a user
    function getPostCount(address _user) public view returns (uint256) {
        return userData[_user].encryptedPosts.length;
    }

    // Get specific post
    function getPost(address _user, uint256 _index) public view returns (string memory) {
        require(_index < userData[_user].encryptedPosts.length, "Post index out of bounds");
        return userData[_user].encryptedPosts[_index];
    }

    // Get alliance count
    function getAllianceCount(address _user) public view returns (uint256) {
        return userData[_user].alliances.length;
    }
}