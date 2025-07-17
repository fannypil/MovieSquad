const Message = require("../models/Message");
const User = require("../models/User");

// Helper function to generate a consistent chat identifier (same as in socketHandler)
const getPrivateChatIdentifier = (userId1, userId2) => {
  return [userId1, userId2].sort().join("_");
};

// @desc    Get all private conversations for the authenticated user
// @route   GET /api/conversations/me
// @access  Private
exports.getMyConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find all unique chatIdentifiers where the current user is either sender or recipient
    const uniqueChatIdentifiers = await Message.distinct("chatIdentifier", {
      $or: [{ sender: userId }, { recipient: userId }],
    });

    // For each unique chatIdentifier, get the last message and the other participant
    const conversations = await Promise.all(
      uniqueChatIdentifiers.map(async (identifier) => {
        const lastMessage = await Message.findOne({
          chatIdentifier: identifier,
        })
          .sort({ createdAt: -1 }) // Get the latest message
          .populate("sender", "username profilePicture")
          .populate("recipient", "username profilePicture")
          .lean(); // Use .lean() for plain JS objects

        if (!lastMessage) return null; // Should not happen if identifier came from a message

        const otherParticipantId =
          lastMessage.sender._id.toString() === userId
            ? lastMessage.recipient._id
            : lastMessage.sender._id;
        const otherParticipant = await User.findById(otherParticipantId)
          .select("username profilePicture")
          .lean();

        return {
          chatIdentifier: identifier,
          lastMessage: lastMessage,
          otherParticipant: otherParticipant,
        };
      })
    );

    // Filter out any nulls and sort by the last message's createdAt
    const sortedConversations = conversations
      .filter((conv) => conv !== null)
      .sort((a, b) => b.lastMessage.createdAt - a.lastMessage.createdAt);

    res.json(sortedConversations);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error fetching conversations");
  }
};

// @desc    Get messages for a specific private conversation
// @route   GET /api/conversations/:chatIdentifier/messages
// @access  Private (only participants can view)
exports.getConversationMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const { chatIdentifier } = req.params;

    // Verify that the current user is a participant in this conversation
    // The chatIdentifier contains the sorted IDs of the two participants
    const participants = chatIdentifier.split("_");
    if (!participants.includes(userId)) {
      return res
        .status(403)
        .json({
          message: "Forbidden: You are not a participant in this conversation.",
        });
    }

    const messages = await Message.find({ chatIdentifier })
      .populate("sender", "username profilePicture")
      .populate("recipient", "username profilePicture")
      .sort({ createdAt: 1 }) // Oldest first
      .limit(100); // Limit historical messages

    res.json(messages);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error fetching conversation messages");
  }
};

// @desc    Mark messages in a private conversation as read by the current user
// @route   PUT /api/conversations/:chatIdentifier/read
// @access  Private (only participants can mark as read)
exports.markConversationAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { chatIdentifier } = req.params;

    // Verify that the current user is a participant
    const participants = chatIdentifier.split("_");
    if (!participants.includes(userId)) {
      return res
        .status(403)
        .json({
          message: "Forbidden: You are not a participant in this conversation.",
        });
    }

    // Find all unread messages for the current user in this chat and add userId to readBy
    await Message.updateMany(
      {
        chatIdentifier: chatIdentifier,
        recipient: userId, // Current user is the recipient
        readBy: { $ne: userId }, // Not already read by this user
      },
      {
        $addToSet: { readBy: userId }, // Add user ID to readBy array
      }
    );

    res.json({ message: "Messages marked as read." });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error marking messages as read");
  }
};
