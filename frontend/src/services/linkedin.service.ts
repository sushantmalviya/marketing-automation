import { apiClient } from "@/services/api-client";

export interface LinkedInOrganizationInsight {
  totalShareStatistics?: {
    impressionCount?: number;
    clickCount?: number;
    likeCount?: number;
    commentCount?: number;
    shareCount?: number;
    engagement?: number;
  };
  organizationalEntity?: string;
}

export interface LinkedInFollowerDemographic {
  followerCountsBySeniority?: Array<{ seniority: string; followerCount: number }>;
  followerCountsByIndustry?: Array<{ industry: string; followerCount: number }>;
  followerCountsByFunction?: Array<{ function: string; followerCount: number }>;
  followerCountsByCountry?: Array<{ country: string; followerCount: number }>;
}

export interface LinkedInComment {
  id: string;
  actor: string;
  message?: { text?: string };
  created?: { time?: number };
}

export const linkedinService = {
  getOrganizationInsights: async (orgUrn?: string, connectionId?: string) => {
    const res = await apiClient.get<{ success: boolean; statistics: LinkedInOrganizationInsight[] }>(
      "/api/analytics/linkedin/insights/",
      {
        params: { org_urn: orgUrn, connection_id: connectionId },
      }
    );
    return res.data;
  },

  getFollowerDemographics: async (orgUrn?: string, connectionId?: string) => {
    const res = await apiClient.get<{ success: boolean; demographics: LinkedInFollowerDemographic[] }>(
      "/api/analytics/linkedin/demographics/",
      {
        params: { org_urn: orgUrn, connection_id: connectionId },
      }
    );
    return res.data;
  },

  getComments: async (shareUrn: string, connectionId?: string) => {
    const res = await apiClient.get<{ success: boolean; comments: LinkedInComment[] }>(
      `/api/analytics/linkedin/comments/${encodeURIComponent(shareUrn)}/`,
      {
        params: { connection_id: connectionId },
      }
    );
    return res.data;
  },

  replyComment: async (shareUrn: string, commentUrn: string, message: string, connectionId?: string) => {
    const res = await apiClient.post<{ success: boolean; reply_urn: string }>(
      `/api/analytics/linkedin/comments/${encodeURIComponent(shareUrn)}/`,
      { comment_urn: commentUrn, message },
      { params: { connection_id: connectionId } }
    );
    return res.data;
  },
};
