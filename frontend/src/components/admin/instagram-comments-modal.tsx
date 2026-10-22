"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Send, X, Loader2, Heart, User } from "lucide-react";
import { toast } from "sonner";
import { instagramService, type InstagramComment } from "@/services/instagram.service";

interface InstagramCommentsModalProps {
  mediaId: string | null;
  postCaption?: string;
  onClose: () => void;
}

export function InstagramCommentsModal({ mediaId, postCaption, onClose }: InstagramCommentsModalProps) {
  const queryClient = useQueryClient();
  const [replyMessage, setReplyMessage] = useState("");
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["instagram-comments", mediaId],
    queryFn: () => instagramService.getComments(mediaId!),
    enabled: !!mediaId,
  });

  const replyMutation = useMutation({
    mutationFn: ({ commentId, message }: { commentId: string; message: string }) =>
      instagramService.replyComment(mediaId!, commentId, message),
    onSuccess: () => {
      toast.success("Reply posted successfully!");
      setReplyMessage("");
      setSelectedCommentId(null);
      queryClient.invalidateQueries({ queryKey: ["instagram-comments", mediaId] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Failed to post reply.");
    },
  });

  if (!mediaId) return null;

  const comments: InstagramComment[] = data?.comments || [];

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCommentId) {
      toast.error("Please select a comment to reply to.");
      return;
    }
    if (!replyMessage.trim()) {
      toast.error("Reply message cannot be empty.");
      return;
    }
    replyMutation.mutate({ commentId: selectedCommentId, message: replyMessage.trim() });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative flex h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-pink-50 text-pink-600 dark:bg-pink-950/40 dark:text-pink-400">
                <MessageSquare size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">Post Comments & Community</h3>
                {postCaption && <p className="line-clamp-1 text-xs text-slate-500">{postCaption}</p>}
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            >
              <X size={18} />
            </button>
          </div>

          {/* Comments List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {isLoading ? (
              <div className="grid h-48 place-items-center text-slate-400">
                <div className="flex items-center gap-2">
                  <Loader2 className="animate-spin" size={18} />
                  <span className="text-sm">Loading comments...</span>
                </div>
              </div>
            ) : error || !comments.length ? (
              <div className="grid h-48 place-items-center text-center text-slate-400">
                <div>
                  <MessageSquare className="mx-auto opacity-40" size={32} />
                  <p className="mt-2 text-xs">No comments on this post yet.</p>
                </div>
              </div>
            ) : (
              comments.map((comment) => (
                <div
                  key={comment.id}
                  onClick={() => setSelectedCommentId(comment.id)}
                  className={`cursor-pointer rounded-xl border p-4 transition-all ${
                    selectedCommentId === comment.id
                      ? "border-pink-500 bg-pink-50/50 shadow-sm dark:bg-pink-950/20"
                      : "border-slate-100 hover:border-slate-200 dark:border-slate-800 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-slate-600 text-xs font-bold dark:bg-slate-800 dark:text-slate-300">
                        {comment.username ? comment.username.charAt(0).toUpperCase() : <User size={12} />}
                      </div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">@{comment.username}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {new Date(comment.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-700 dark:text-slate-300">{comment.text}</p>
                  {comment.like_count !== undefined && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                      <Heart size={10} className="text-pink-500" />
                      {comment.like_count} likes
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Reply Form */}
          <form onSubmit={handleSendReply} className="border-t border-slate-100 p-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            {selectedCommentId && (
              <div className="mb-2 flex items-center justify-between text-xs text-pink-600 dark:text-pink-400">
                <span>Replying to comment ID: {selectedCommentId}</span>
                <button
                  type="button"
                  onClick={() => setSelectedCommentId(null)}
                  className="text-[10px] underline hover:text-slate-600"
                >
                  Cancel
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                placeholder={selectedCommentId ? "Type your reply..." : "Click a comment above to reply..."}
                disabled={!selectedCommentId || replyMutation.isPending}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!selectedCommentId || replyMutation.isPending || !replyMessage.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-pink-600 px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-pink-700 disabled:opacity-50"
              >
                {replyMutation.isPending ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <>
                    <Send size={14} />
                    Reply
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
