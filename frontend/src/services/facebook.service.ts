import { apiClient } from "@/services/api-client";

export interface FacebookPageInsight {
  name: string;
  period: string;
  values: Array<{ value: number; end_time?: string }>;
  title?: string;
  description?: string;
}

export interface FacebookPost {
  id: string;
  message?: string;
  created_time: string;
  full_picture?: string;
  permalink_url?: string;
  shares?: { count: number };
  reactions?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
}

export interface FacebookComment {
  id: string;
  from?: { name: string; id: string };
  message: string;
  created_time: string;
  like_count?: number;
  comment_count?: number;
}

export const facebookService = {
  getPageInsights: async (pageId?: string, connectionId?: string) => {
    const res = await apiClient.get<{ success: boolean; insights: FacebookPageInsight[]; page_id: string }>(
      "/api/analytics/facebook/insights/",
      {
        params: { page_id: pageId, connection_id: connectionId },
      }
    );
    return res.data;
  },

  getRecentPosts: async (pageId?: string, limit = 25, connectionId?: string) => {
    const res = await apiClient.get<{ success: boolean; posts: FacebookPost[] }>(
      "/api/analytics/facebook/posts/",
      {
        params: { page_id: pageId, limit, connection_id: connectionId },
      }
    );
    return res.data;
  },

  getComments: async (postId: string, connectionId?: string) => {
    const res = await apiClient.get<{ success: boolean; comments: FacebookComment[] }>(
      `/api/analytics/facebook/posts/${encodeURIComponent(postId)}/comments/`,
      {
        params: { connection_id: connectionId },
      }
    );
    return res.data;
  },

  replyComment: async (postId: string, commentId: string, message: string, connectionId?: string) => {
    const res = await apiClient.post<{ success: boolean; reply_id: string }>(
      `/api/analytics/facebook/posts/${encodeURIComponent(postId)}/comments/`,
      { comment_id: commentId, message },
      { params: { connection_id: connectionId } }
    );
    return res.data;
  },
};
