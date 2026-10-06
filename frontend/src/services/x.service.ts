import { apiClient } from "@/services/api-client";

export interface XPublicMetrics {
  followers_count?: number;
  following_count?: number;
  tweet_count?: number;
  listed_count?: number;
}

export interface XTweetPublicMetrics {
  retweet_count?: number;
  reply_count?: number;
  like_count?: number;
  quote_count?: number;
  impression_count?: number;
}

export interface XTweet {
  id: string;
  text: string;
  created_at: string;
  public_metrics?: XTweetPublicMetrics;
}

export const xService = {
  getUserInsights: async (connectionId?: string) => {
    const res = await apiClient.get<{
      success: boolean;
      user?: { username?: string };
      public_metrics: XPublicMetrics;
    }>("/api/analytics/x/insights/", {
      params: { connection_id: connectionId },
    });
    return res.data;
  },

  getRecentTweets: async (limit = 25, connectionId?: string) => {
    const res = await apiClient.get<{
      success: boolean;
      tweets: XTweet[];
      username?: string;
    }>("/api/analytics/x/tweets/", {
      params: { limit, connection_id: connectionId },
    });
    return res.data;
  },
};
