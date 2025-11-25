import { FirebaseService } from "./firebaseService";
import { EncryptionService } from "./encryption";

// Conversation Tracking and Analysis for FUSE
export class ConversationTracker {
  private static readonly CONVERSATION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

  // Track a sent message
  static async trackMessage(
    senderAddress: string,
    receiverAddress: string,
    messageData: MessageData
  ): Promise<void> {
    try {
      const conversationId = this.generateConversationId(
        senderAddress,
        receiverAddress
      );
      const timestamp = Date.now();

      // Encrypt message data for privacy
      const messageJson = JSON.stringify(messageData);
      const messagingKey = FirebaseService.getMessagingKey();
      if (!messagingKey) {
        throw new Error("Firebase service not initialized");
      }
      const encryptedData = EncryptionService.encrypt(
        messageJson,
        messagingKey
      );

      const messageRecord = {
        id: `${conversationId}_${timestamp}`,
        sender: senderAddress,
        receiver: receiverAddress,
        timestamp,
        data: JSON.stringify(encryptedData),
        conversationId,
      };

      // Store in Firebase (encrypted)
      await FirebaseService.storeConversationMessage(messageRecord);

      // Update conversation summary
      await this.updateConversationSummary(
        conversationId,
        senderAddress,
        receiverAddress,
        messageData
      );
    } catch (error) {
      console.error("Failed to track message:", error);
    }
  }

  // Track response time when receiving a message
  static async trackResponse(
    conversationId: string,
    responderAddress: string,
    responseTime: number
  ): Promise<void> {
    try {
      const summary = await FirebaseService.getConversationSummary(
        conversationId
      );
      if (!summary) return;

      // Update response time statistics
      const currentStats = summary.responseStats || {
        averageResponseTime: 0,
        totalResponses: 0,
        fastestResponse: Infinity,
        slowestResponse: 0,
      };

      const newTotal = currentStats.totalResponses + 1;
      const newAverage =
        (currentStats.averageResponseTime * currentStats.totalResponses +
          responseTime) /
        newTotal;

      const updatedStats = {
        averageResponseTime: Math.round(newAverage),
        totalResponses: newTotal,
        fastestResponse: Math.min(currentStats.fastestResponse, responseTime),
        slowestResponse: Math.max(currentStats.slowestResponse, responseTime),
      };

      await FirebaseService.updateConversationSummary(conversationId, {
        responseStats: updatedStats,
        lastActivity: Date.now(),
      });
    } catch (error) {
      console.error("Failed to track response:", error);
    }
  }

  // Generate conversation summary for algorithm
  static async generateInteractionSummary(
    userAddress: string
  ): Promise<InteractionSummary> {
    try {
      const conversations = await FirebaseService.getUserConversations(
        userAddress
      );
      const summaries: ConversationSummary[] = [];

      for (const conv of conversations) {
        const summary = await FirebaseService.getConversationSummary(conv.id);
        if (summary) {
          summaries.push(summary);
        }
      }

      return this.analyzeInteractionPatterns(summaries, userAddress);
    } catch (error) {
      console.error("Failed to generate interaction summary:", error);
      return this.getDefaultInteractionSummary();
    }
  }

  // Analyze interaction patterns from conversation data
  private static analyzeInteractionPatterns(
    summaries: ConversationSummary[],
    userAddress: string
  ): InteractionSummary {
    if (summaries.length === 0) {
      return this.getDefaultInteractionSummary();
    }

    // Analyze response times
    const responseTimes = summaries
      .filter((s) => s.responseStats)
      .map((s) => s.responseStats!.averageResponseTime);

    const avgResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 3600000; // 1 hour default

    // Analyze message patterns
    const messagePatterns = summaries
      .map((s) => s.messagePatterns)
      .filter((pattern): pattern is MessagePatterns => pattern !== undefined);
    const communicationStyle =
      this.determineCommunicationStyle(messagePatterns);

    // Analyze engagement levels
    const engagementLevels = summaries.map((s) => s.engagementLevel);
    const avgEngagement =
      engagementLevels.length > 0
        ? engagementLevels.reduce((a, b) => a + b, 0) / engagementLevels.length
        : 50;

    // Analyze conversation depth
    const conversationDepths = summaries.map((s) => s.conversationDepth);
    const avgDepth =
      conversationDepths.length > 0
        ? conversationDepths.reduce((a, b) => a + b, 0) /
          conversationDepths.length
        : 3;

    return {
      communicationStyle,
      responseTimeCategory: this.categorizeResponseTime(avgResponseTime),
      engagementLevel: Math.round(avgEngagement),
      conversationDepth: Math.round(avgDepth),
      preferredTopics: this.extractPreferredTopics(summaries),
      interactionPreferences: this.determineInteractionPreferences(summaries),
      reliabilityScore: this.calculateReliabilityScore(summaries),
      lastActive: Date.now(),
    };
  }

  // Determine communication style from message patterns
  private static determineCommunicationStyle(
    patterns: MessagePatterns[]
  ): CommunicationStyleAnalysis {
    if (patterns.length === 0) {
      return { style: "balanced", formality: "casual", verbosity: "moderate" };
    }

    // Analyze formality
    const formalityScores = patterns.map((p) => p.formalityScore || 50);
    const avgFormality =
      formalityScores.reduce((a, b) => a + b, 0) / formalityScores.length;

    // Analyze verbosity
    const verbosityScores = patterns.map((p) => p.averageLength || 50);
    const avgVerbosity =
      verbosityScores.reduce((a, b) => a + b, 0) / verbosityScores.length;

    // Analyze directness
    const directnessIndicators = patterns.filter(
      (p) => p.directnessScore && p.directnessScore > 70
    ).length;
    const indirectIndicators = patterns.filter(
      (p) => p.directnessScore && p.directnessScore < 30
    ).length;

    let style: "direct" | "indirect" | "balanced" = "balanced";
    if (directnessIndicators > indirectIndicators) style = "direct";
    if (indirectIndicators > directnessIndicators) style = "indirect";

    return {
      style,
      formality:
        avgFormality > 70 ? "formal" : avgFormality > 30 ? "mixed" : "casual",
      verbosity:
        avgVerbosity > 70
          ? "verbose"
          : avgVerbosity > 30
          ? "moderate"
          : "concise",
    };
  }

  // Categorize response time
  private static categorizeResponseTime(avgTime: number): ResponseTimeCategory {
    if (avgTime < 300000) return "very_fast"; // < 5 minutes
    if (avgTime < 1800000) return "fast"; // < 30 minutes
    if (avgTime < 3600000) return "moderate"; // < 1 hour
    if (avgTime < 86400000) return "slow"; // < 24 hours
    return "very_slow"; // > 24 hours
  }

  // Extract preferred topics from conversations
  private static extractPreferredTopics(
    summaries: ConversationSummary[]
  ): string[] {
    const topicCounts: { [key: string]: number } = {};

    summaries.forEach((summary) => {
      if (summary.commonTopics) {
        summary.commonTopics.forEach((topic) => {
          topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        });
      }
    });

    return Object.entries(topicCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([topic]) => topic);
  }

  // Determine interaction preferences
  private static determineInteractionPreferences(
    summaries: ConversationSummary[]
  ): InteractionPreferences {
    const preferences = {
      groupChats: 0,
      oneOnOne: 0,
      deepConversations: 0,
      lightChats: 0,
      planning: 0,
      spontaneous: 0,
    };

    summaries.forEach((summary) => {
      if (summary.interactionType === "group") preferences.groupChats++;
      if (summary.interactionType === "one_on_one") preferences.oneOnOne++;
      if (summary.conversationDepth && summary.conversationDepth > 7)
        preferences.deepConversations++;
      if (summary.conversationDepth && summary.conversationDepth <= 3)
        preferences.lightChats++;
      if (summary.hasPlanning) preferences.planning++;
      if (summary.hasSpontaneous) preferences.spontaneous++;
    });

    return {
      socialStyle:
        preferences.groupChats > preferences.oneOnOne
          ? "group_oriented"
          : "one_on_one",
      conversationDepth:
        preferences.deepConversations > preferences.lightChats
          ? "deep"
          : "light",
      planningStyle:
        preferences.planning > preferences.spontaneous
          ? "planner"
          : "spontaneous",
    };
  }

  // Calculate reliability score based on consistency
  private static calculateReliabilityScore(
    summaries: ConversationSummary[]
  ): number {
    if (summaries.length === 0) return 50;

    let consistencyScore = 0;

    // Response time consistency
    const responseTimes = summaries
      .filter((s) => s.responseStats)
      .map((s) => s.responseStats!.averageResponseTime);

    if (responseTimes.length > 1) {
      const avg =
        responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const variance =
        responseTimes.reduce((sum, time) => sum + Math.pow(time - avg, 2), 0) /
        responseTimes.length;
      const stdDev = Math.sqrt(variance);
      const cv = stdDev / avg; // Coefficient of variation
      consistencyScore += Math.max(0, 100 - cv * 100); // Lower variance = higher consistency
    }

    // Activity consistency
    const activeConversations = summaries.filter((s) => s.isActive).length;
    consistencyScore += (activeConversations / summaries.length) * 50;

    return Math.round(Math.min(100, consistencyScore));
  }

  // Update conversation summary with new message data
  private static async updateConversationSummary(
    conversationId: string,
    senderAddress: string,
    receiverAddress: string,
    messageData: MessageData
  ): Promise<void> {
    try {
      const existingSummary = await FirebaseService.getConversationSummary(
        conversationId
      );

      if (!existingSummary) {
        // Create new summary
        const newSummary: ConversationSummary = {
          id: conversationId,
          participants: [senderAddress, receiverAddress],
          messageCount: 1,
          lastActivity: Date.now(),
          isActive: true,
          messagePatterns: this.analyzeMessagePatterns([messageData]),
          engagementLevel: this.calculateEngagementLevel([messageData]),
          conversationDepth: this.calculateConversationDepth([messageData]),
          interactionType: "one_on_one",
          commonTopics: this.extractTopicsFromMessage(messageData),
          hasPlanning:
            messageData.content.toLowerCase().includes("plan") ||
            messageData.content.toLowerCase().includes("meet"),
          hasSpontaneous:
            messageData.content.toLowerCase().includes("spontaneous") ||
            messageData.content.toLowerCase().includes("random"),
        };

        await FirebaseService.createConversationSummary(newSummary);
      } else {
        // Update existing summary
        const updatedPatterns = this.analyzeMessagePatterns([
          ...(existingSummary.messagePatterns
            ? [existingSummary.messagePatterns]
            : []),
          messageData,
        ]);

        const updatedSummary = {
          ...existingSummary,
          messageCount: existingSummary.messageCount + 1,
          lastActivity: Date.now(),
          messagePatterns: updatedPatterns,
          engagementLevel: this.calculateEngagementLevel([messageData]),
          conversationDepth: Math.max(
            existingSummary.conversationDepth,
            this.calculateConversationDepth([messageData])
          ),
          commonTopics: [
            ...new Set([
              ...(existingSummary.commonTopics || []),
              ...this.extractTopicsFromMessage(messageData),
            ]),
          ],
        };

        await FirebaseService.updateConversationSummary(
          conversationId,
          updatedSummary
        );
      }
    } catch (error) {
      console.error("Failed to update conversation summary:", error);
    }
  }

  // Analyze message patterns
  private static analyzeMessagePatterns(
    messages: MessageData[]
  ): MessagePatterns {
    if (messages.length === 0) {
      return {
        averageLength: 0,
        formalityScore: 50,
        directnessScore: 50,
        questionRatio: 0,
        emojiRatio: 0,
      };
    }

    const avgLength =
      messages.reduce((sum, msg) => sum + msg.content.length, 0) /
      messages.length;

    // Simple formality analysis
    const formalWords = [
      "therefore",
      "however",
      "moreover",
      "consequently",
      "furthermore",
    ];
    const casualWords = [
      "kinda",
      "sorta",
      "wanna",
      "gonna",
      "lol",
      "omg",
      "btw",
    ];

    let formalityScore = 50;
    messages.forEach((msg) => {
      const content = msg.content.toLowerCase();
      formalWords.forEach((word) => {
        if (content.includes(word)) formalityScore += 10;
      });
      casualWords.forEach((word) => {
        if (content.includes(word)) formalityScore -= 10;
      });
    });
    formalityScore = Math.max(0, Math.min(100, formalityScore));

    // Directness analysis
    const directIndicators = ["i want", "i need", "i love", "i hate", "let's"];
    const indirectIndicators = [
      "maybe",
      "perhaps",
      "kinda",
      "sorta",
      "i think",
    ];

    let directnessScore = 50;
    messages.forEach((msg) => {
      const content = msg.content.toLowerCase();
      directIndicators.forEach((word) => {
        if (content.includes(word)) directnessScore += 5;
      });
      indirectIndicators.forEach((word) => {
        if (content.includes(word)) directnessScore -= 5;
      });
    });
    directnessScore = Math.max(0, Math.min(100, directnessScore));

    // Question ratio
    const questionCount = messages.filter((msg) =>
      msg.content.includes("?")
    ).length;
    const questionRatio = questionCount / messages.length;

    // Emoji ratio (simple detection)
    const emojiCount = messages.filter((msg) =>
      /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(
        msg.content
      )
    ).length;
    const emojiRatio = emojiCount / messages.length;

    return {
      averageLength: Math.round(avgLength),
      formalityScore,
      directnessScore,
      questionRatio: Math.round(questionRatio * 100) / 100,
      emojiRatio: Math.round(emojiRatio * 100) / 100,
    };
  }

  // Calculate engagement level
  private static calculateEngagementLevel(messages: MessageData[]): number {
    if (messages.length === 0) return 50;

    let score = 50;

    // Length bonus
    const avgLength =
      messages.reduce((sum, msg) => sum + msg.content.length, 0) /
      messages.length;
    if (avgLength > 100) score += 20;
    else if (avgLength > 50) score += 10;

    // Question bonus (shows interest)
    const questionCount = messages.filter((msg) =>
      msg.content.includes("?")
    ).length;
    score += questionCount * 5;

    // Emoji bonus (shows personality)
    const emojiCount = messages.filter((msg) =>
      /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(
        msg.content
      )
    ).length;
    score += emojiCount * 3;

    return Math.min(100, Math.max(0, score));
  }

  // Calculate conversation depth
  private static calculateConversationDepth(messages: MessageData[]): number {
    if (messages.length === 0) return 1;

    let depth = 1;

    // Analyze content for depth indicators
    const deepTopics = [
      "philosophy",
      "meaning",
      "purpose",
      "future",
      "dreams",
      "goals",
      "feelings",
      "emotions",
    ];
    const surfaceTopics = ["weather", "food", "movies", "music", "sports"];

    messages.forEach((msg) => {
      const content = msg.content.toLowerCase();
      deepTopics.forEach((topic) => {
        if (content.includes(topic)) depth += 2;
      });
      surfaceTopics.forEach((topic) => {
        if (content.includes(topic)) depth += 0.5;
      });
    });

    // Question depth
    const questions = messages.filter((msg) =>
      msg.content.includes("?")
    ).length;
    depth += questions * 0.5;

    return Math.min(10, Math.max(1, depth));
  }

  // Extract topics from message
  private static extractTopicsFromMessage(message: MessageData): string[] {
    const content = message.content.toLowerCase();
    const topics: string[] = [];

    // Simple topic extraction based on keywords
    const topicKeywords = {
      technology: ["code", "programming", "tech", "computer", "software"],
      travel: ["travel", "trip", "vacation", "adventure", "explore"],
      music: ["music", "song", "band", "concert", "instrument"],
      sports: ["sport", "game", "team", "play", "athlete"],
      food: ["food", "cook", "recipe", "restaurant", "eat"],
      art: ["art", "draw", "paint", "creative", "design"],
      books: ["book", "read", "author", "story", "novel"],
      fitness: ["gym", "workout", "exercise", "health", "fit"],
      gaming: ["game", "gaming", "play", "video game", "console"],
      movies: ["movie", "film", "cinema", "actor", "director"],
    };

    Object.entries(topicKeywords).forEach(([topic, keywords]) => {
      if (keywords.some((keyword) => content.includes(keyword))) {
        topics.push(topic);
      }
    });

    return topics;
  }

  // Generate conversation ID
  private static generateConversationId(user1: string, user2: string): string {
    return [user1, user2].sort().join("_");
  }

  // Default interaction summary
  private static getDefaultInteractionSummary(): InteractionSummary {
    return {
      communicationStyle: {
        style: "balanced",
        formality: "casual",
        verbosity: "moderate",
      },
      responseTimeCategory: "moderate",
      engagementLevel: 50,
      conversationDepth: 3,
      preferredTopics: [],
      interactionPreferences: {
        socialStyle: "one_on_one",
        conversationDepth: "balanced",
        planningStyle: "balanced",
      },
      reliabilityScore: 50,
      lastActive: Date.now(),
    };
  }
}

// Type definitions
export interface MessageData {
  content: string;
  timestamp: number;
  type: "text" | "image" | "emoji";
  length: number;
}

export interface ConversationSummary {
  id: string;
  participants: string[];
  messageCount: number;
  lastActivity: number;
  isActive: boolean;
  messagePatterns?: MessagePatterns;
  responseStats?: ResponseStats;
  engagementLevel: number;
  conversationDepth: number;
  interactionType: "one_on_one" | "group";
  commonTopics?: string[];
  hasPlanning: boolean;
  hasSpontaneous: boolean;
}

export interface MessagePatterns {
  averageLength: number;
  formalityScore: number;
  directnessScore: number;
  questionRatio: number;
  emojiRatio: number;
}

export interface ResponseStats {
  averageResponseTime: number;
  totalResponses: number;
  fastestResponse: number;
  slowestResponse: number;
}

export interface InteractionSummary {
  communicationStyle: CommunicationStyleAnalysis;
  responseTimeCategory: ResponseTimeCategory;
  engagementLevel: number;
  conversationDepth: number;
  preferredTopics: string[];
  interactionPreferences: InteractionPreferences;
  reliabilityScore: number;
  lastActive: number;
}

export interface CommunicationStyleAnalysis {
  style: "direct" | "indirect" | "balanced";
  formality: "formal" | "casual" | "mixed";
  verbosity: "concise" | "moderate" | "verbose";
}

export type ResponseTimeCategory =
  | "very_fast"
  | "fast"
  | "moderate"
  | "slow"
  | "very_slow";

export interface InteractionPreferences {
  socialStyle: "group_oriented" | "one_on_one";
  conversationDepth: "deep" | "light" | "balanced";
  planningStyle: "planner" | "spontaneous" | "balanced";
}
