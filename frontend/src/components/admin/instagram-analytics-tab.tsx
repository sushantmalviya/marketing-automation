"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Instagram, Eye, Users, Heart, MessageSquare, Share2,
  Bookmark, Play, ExternalLink, Loader2, BarChart3, TrendingUp
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid
} from "recharts";
import { instagramService, type InstagramMediaPost } from "@/services/instagram.service";
import { InstagramCommentsModal } from "./instagram-comments-modal";

export function InstagramAnalyticsTab() {
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [selectedMediaCaption, setSelectedMediaCaption] = useState<string | undefined>();

  // Fetch Account Insights
  const { data: insightsData, isLoading: isInsightsLoading } = useQuery({
    queryKey: ["instagram-account-insights"],
    queryFn: () => instagramService.getAccountInsights(),
  });

  // Fetch Recent Media Feed
  const { data: mediaData, isLoading: isMediaLoading } = useQuery({
    queryKey: ["instagram-recent-media"],
    queryFn: () => instagramService.getRecentMedia(20),
  });

  const posts: InstagramMediaPost[] = mediaData?.posts || [];
  const rawInsights = insightsData?.insights || [];

  // Parse insight metrics
  const getMetricVal = (name: string) => {
    const item = rawInsights.find((i: any) => i.name === name);
    if (!item || !item.values || !item.values.length) return 0;
    return item.values[0].value || 0;
  };

  const reach = getMetricVal("reach");
  const impressions = getMetricVal("impressions");
  const profileViews = getMetricVal("profile_views");
  const accountsEngaged = getMetricVal("accounts_engaged");
  const followers = getMetricVal("follower_count");

  // Chart dummy dataset based on insights
  const chartData = [
    { day: "Mon", reach: Math.round(reach * 0.12), impressions: Math.round(impressions * 0.15) },
    { day: "Tue", reach: Math.round(reach * 0.18), impressions: Math.round(impressions * 0.22) },
    { day: "Wed", reach: Math.round(reach * 0.14), impressions: Math.round(impressions * 0.17) },
    { day: "Thu", reach: Math.round(reach * 0.25), impressions: Math.round(impressions * 0.28) },
    { day: "Fri", reach: Math.round(reach * 0.20), impressions: Math.round(impressions * 0.23) },
    { day: "Sat", reach: Math.round(reach * 0.28), impressions: Math.round(impressions * 0.32) },
    { day: "Sun", reach: Math.round(reach * 0.22), impressions: Math.round(impressions * 0.26) },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 p-6 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/20 backdrop-blur-md">
            <Instagram size={28} />
          </div>
          <div>
            <h2 className="text-xl font-bold">Instagram Business Insights</h2>
            <p className="text-xs text-white/80">Track reach, engagement, media analytics, and comments in real-time</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="sa-card p-5">
          <div className="flex items-center justify-between text-pink-600 dark:text-pink-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Reach</span>
            <Eye size={18} />
          </div>
          <strong className="mt-3 block text-2xl font-black text-slate-900 dark:text-white">
            {isInsightsLoading ? <Loader2 className="animate-spin" size={20} /> : reach.toLocaleString()}
          </strong>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="sa-card p-5">
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Impressions</span>
            <BarChart3 size={18} />
          </div>
          <strong className="mt-3 block text-2xl font-black text-slate-900 dark:text-white">
            {isInsightsLoading ? <Loader2 className="animate-spin" size={20} /> : impressions.toLocaleString()}
          </strong>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="sa-card p-5">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Profile Views</span>
            <Users size={18} />
          </div>
          <strong className="mt-3 block text-2xl font-black text-slate-900 dark:text-white">
            {isInsightsLoading ? <Loader2 className="animate-spin" size={20} /> : profileViews.toLocaleString()}
          </strong>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="sa-card p-5">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Accounts Engaged</span>
            <TrendingUp size={18} />
          </div>
          <strong className="mt-3 block text-2xl font-black text-slate-900 dark:text-white">
            {isInsightsLoading ? <Loader2 className="animate-spin" size={20} /> : accountsEngaged.toLocaleString()}
          </strong>
        </motion.div>
      </div>

      {/* Chart Section */}
      <div className="sa-card p-6">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
          Reach vs Impressions Trend
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorReach" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ec4899" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorImp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip />
              <Area type="monotone" dataKey="reach" stroke="#ec4899" fillOpacity={1} fill="url(#colorReach)" name="Reach" />
              <Area type="monotone" dataKey="impressions" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorImp)" name="Impressions" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Published Feed */}
      <div className="sa-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Recent Published Posts & Reels
          </h3>
          <span className="text-xs text-slate-400">{posts.length} posts loaded</span>
        </div>

        {isMediaLoading ? (
          <div className="grid h-48 place-items-center text-slate-400">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : !posts.length ? (
          <div className="grid h-48 place-items-center text-center text-slate-400">
            <div>
              <Instagram className="mx-auto opacity-30" size={40} />
              <p className="mt-2 text-xs">No recent Instagram posts found.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <div
                key={post.id}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-100 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                {/* Media Type Badge */}
                <div className="mb-2 flex items-center justify-between">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {post.media_type}
                  </span>
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-400 hover:text-pink-600"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>

                {/* Caption */}
                <p className="line-clamp-2 text-xs text-slate-700 dark:text-slate-300">
                  {post.caption || "No caption provided"}
                </p>

                {/* Engagement Stats */}
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-semibold text-slate-500 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-pink-600">
                      <Heart size={14} />
                      {post.like_count ?? 0}
                    </span>
                    <span className="flex items-center gap-1 text-blue-600">
                      <MessageSquare size={14} />
                      {post.comments_count ?? 0}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedMediaId(post.id);
                      setSelectedMediaCaption(post.caption);
                    }}
                    className="rounded-lg bg-pink-50 px-2.5 py-1 text-[11px] font-bold text-pink-600 hover:bg-pink-100 dark:bg-pink-950/40 dark:text-pink-400"
                  >
                    View Comments
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Comments Drawer / Modal */}
      {selectedMediaId && (
        <InstagramCommentsModal
          mediaId={selectedMediaId}
          postCaption={selectedMediaCaption}
          onClose={() => setSelectedMediaId(null)}
        />
      )}
    </div>
  );
}
