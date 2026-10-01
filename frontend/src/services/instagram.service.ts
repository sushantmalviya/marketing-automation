import { apiClient } from "@/services/api-client";

export interface InstagramInsightsData {
  reach: number;
  impressions: number;
  profile_views: number;
  follower_count: number;
  accounts_engaged: number;
}

export interface InstagramMediaPost {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REELS";
  media_url?: string;
  permalink: string;
  thumbnail_url?: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

export interface InstagramComment {
  id: string;
  text: string;
  username: string;
  timestamp: string;
  like_count?: number;
}

export const instagramService = {
  getAccountInsights: async (connectionId?: string) => {
    const res = await apiClient.get<{ success: boolean; insights: any[] }>("/api/analytics/instagram/insights/", {
      params: { connection_id: connectionId },
    });
    return res.data;
  },

  getRecentMedia: async (limit = 25, connectionId?: string) => {
    const res = await apiClient.get<{ success: boolean; posts: InstagramMediaPost[] }>("/api/analytics/instagram/media/", {
      params: { limit, connection_id: connectionId },
    });
    return res.data;
  },

  getMediaMetrics: async (mediaId: string, connectionId?: string) => {
    const res = await apiClient.get<{ success: boolean; media_id: string; metrics: any[] }>(`/api/analytics/instagram/media/${mediaId}/insights/`, {
      params: { connection_id: connectionId },
    });
    return res.data;
  },

  getComments: async (mediaId: string, connectionId?: string) => {
    const res = await apiClient.get<{ success: boolean; comments: InstagramComment[] }>(`/api/analytics/instagram/media/${mediaId}/comments/`, {
      params: { connection_id: connectionId },
    });
    return res.data;
  },

  replyComment: async (mediaId: string, commentId: string, message: string, connectionId?: string) => {
    const res = await apiClient.post<{ success: boolean; reply_id: string }>(
      `/api/analytics/instagram/media/${mediaId}/comments/`,
      { comment_id: commentId, message },
      { params: { connection_id: connectionId } }
    );
    return res.data;
  },
};
