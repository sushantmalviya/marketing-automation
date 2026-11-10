import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AxiosResponse } from "axios";
import type { AnchorHTMLAttributes, ImgHTMLAttributes, ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserContentStudio } from "@/components/user/workspace";
import { apiClient } from "@/services/api-client";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({
    alt,
    src,
    unoptimized,
    fill,
    ...rest
  }: ImgHTMLAttributes<HTMLImageElement> & {
    src: string;
    alt: string;
    unoptimized?: boolean;
    fill?: boolean;
  }) => {
    void unoptimized;
    void fill;
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} src={src} {...rest} />;
  },
}));

function renderWithQuery(ui: ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("Merged AI Content Generator (UserContentStudio)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("merges image model, quality, aspect ratio, and live credits into AI Content Generator without a separate AI Image Generator tab", async () => {
    let currentImageUrl = "https://cdn.example.com/v1.png";
    let currentModel: "google_nano_banana" | "openai_gpt_image_2_5" = "google_nano_banana";
    let currentQuality: "STANDARD" | "HIGH" | "ULTRA" = "STANDARD";
    let currentRatio: "1:1" | "4:5" | "9:16" | "16:9" = "1:1";

    const postSpy = vi.spyOn(apiClient, "post").mockImplementation(async (url, data) => {
      if (url === "/api/content/images/estimate/") {
        const body = data as {
          model: "google_nano_banana" | "openai_gpt_image_2_5";
          quality: "STANDARD" | "HIGH" | "ULTRA";
          aspect_ratio: string;
          generate_image?: boolean;
          caption_count?: number;
        };
        const table: Record<string, Record<string, number>> = {
          google_nano_banana: { STANDARD: 5, HIGH: 10, ULTRA: 20 },
          openai_gpt_image_2_5: { STANDARD: 8, HIGH: 15, ULTRA: 25 },
        };
        const imageCredits = body.generate_image === false ? 0 : table[body.model][body.quality];
        const captionCount = body.caption_count ?? 0;
        const captionCredits = captionCount * 5;
        const total = imageCredits + captionCredits;
        return {
          data: {
            model: body.model,
            model_label:
              body.model === "google_nano_banana" ? "Google Nano Banana" : "OpenAI GPT Image 2.5",
            provider: body.model === "google_nano_banana" ? "google" : "openai",
            provider_model_id: "gemini-nano-banana-2.1",
            quality: body.quality,
            aspect_ratio: body.aspect_ratio,
            credits: total,
            image_credits: imageCredits,
            caption_credits: captionCredits,
            caption_count: captionCount,
            caption_unit_credits: 5,
            base_credits: imageCredits,
            reference_surcharge: 0,
            reference_image_count: 0,
            wallet_balance: 100,
            sufficient_credits: true,
            remaining_after_generation: 100 - total,
            brand_identity_active: true,
            brand_logo_injected: false,
            brand_reference_count: 0,
          },
        } as AxiosResponse;
      }

      if (url === "/api/content/content-drafts/") {
        const body = data as {
          original_prompt: string;
          image_model: "google_nano_banana" | "openai_gpt_image_2_5";
          image_quality: "STANDARD" | "HIGH" | "ULTRA";
          image_aspect_ratio: "1:1" | "4:5" | "9:16" | "16:9";
        };
        currentModel = body.image_model;
        currentQuality = body.image_quality;
        currentRatio = body.image_aspect_ratio;
        return {
          data: {
            id: "draft-1",
            original_prompt: body.original_prompt,
            enhanced_prompt: "",
            image_model: currentModel,
            image_quality: currentQuality,
            image_aspect_ratio: currentRatio,
            workflow_state: "DRAFT",
            platforms: [
              {
                id: "plat-1",
                platform: "INSTAGRAM",
                status: "PENDING",
                approval_status: "NONE",
                scheduled_datetime: null,
                published_datetime: null,
                caption: { caption_text: "Fresh coffee!", hashtags: "", cta: "" },
                images: [{ asset_url: currentImageUrl, asset_name: "Generated" }],
              },
            ],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        } as AxiosResponse;
      }

      if (url === "/api/content/content-drafts/draft-1/regenerate/") {
        const body = data as { reason?: string; model?: typeof currentModel; quality?: typeof currentQuality; aspect_ratio?: typeof currentRatio };
        if (body.reason?.includes("sunset")) {
          currentImageUrl = "https://cdn.example.com/v2.png";
        }
        if (body.model) currentModel = body.model;
        if (body.quality) currentQuality = body.quality;
        if (body.aspect_ratio) currentRatio = body.aspect_ratio;
        return { data: { version_id: "ver-1", version_number: 2 } } as AxiosResponse;
      }

      return { data: {} } as AxiosResponse;
    });

    vi.spyOn(apiClient, "patch").mockResolvedValue({ data: {} } as AxiosResponse);
    vi.spyOn(apiClient, "get").mockImplementation(async (url) => {
      if (url === "/api/content/content-drafts/draft-1/") {
        return {
          data: {
            id: "draft-1",
            original_prompt: "Minimalist studio espresso cup",
            enhanced_prompt: "Minimalist studio espresso cup",
            image_model: currentModel,
            image_quality: currentQuality,
            image_aspect_ratio: currentRatio,
            workflow_state: "DRAFT",
            platforms: [
              {
                id: "plat-1",
                platform: "INSTAGRAM",
                status: "PENDING",
                approval_status: "NONE",
                scheduled_datetime: null,
                published_datetime: null,
                caption: { caption_text: "Fresh coffee!", hashtags: "", cta: "" },
                images: [{ asset_url: currentImageUrl, asset_name: "Generated" }],
              },
            ],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        } as AxiosResponse;
      }
      return { data: { results: [] } } as AxiosResponse;
    });

    renderWithQuery(<UserContentStudio />);

    // Must NOT render a separate AI Image Generator tab
    expect(screen.getByRole("button", { name: /AI Content Generator/i })).toBeVisible();
    expect(screen.queryByRole("button", { name: /^AI Image Generator$/i })).toBeNull();

    // Must expose merged options directly inside AI Content Generator
    expect(screen.getByRole("radiogroup", { name: /AI Model/i })).toBeVisible();
    expect(screen.getByRole("radiogroup", { name: /Image Quality/i })).toBeVisible();
    expect(screen.getByRole("radiogroup", { name: /Aspect Ratio/i })).toBeVisible();

    // Default: Nano Banana Standard (5) + 4 channels captions (20) = 25 credits
    await waitFor(() => {
      expect(screen.getByTestId("estimated-credits")).toHaveTextContent("25 credits");
      expect(screen.getByTestId("wallet-balance")).toHaveTextContent("100 credits");
    });

    // Uncheck Caption & switch to OpenAI GPT Image 2.5 + Ultra + 4:5 -> 25 image-only credits
    fireEvent.click(screen.getByLabelText(/Caption/i));
    fireEvent.click(screen.getByRole("radio", { name: /OpenAI GPT Image 2\.5/i }));
    fireEvent.click(screen.getByRole("radio", { name: /Ultra/i }));
    fireEvent.click(screen.getByRole("radio", { name: "4:5" }));

    await waitFor(() => {
      expect(screen.getByTestId("estimated-credits")).toHaveTextContent("25 credits");
    });

    const promptBox = screen.getByPlaceholderText(/Example: Write a LinkedIn post/i);
    fireEvent.change(promptBox, { target: { value: "Minimalist studio espresso cup" } });

    const genBtn = screen.getByRole("button", { name: /Generate Content/i });
    expect(genBtn).toBeEnabled();
    fireEvent.click(genBtn);

    await waitFor(() => {
      expect(screen.getByText(/Preview & Customize/i)).toBeVisible();
    });

    const initialRegenCall = postSpy.mock.calls.find(
      ([url]) => url === "/api/content/content-drafts/draft-1/regenerate/",
    );
    expect(initialRegenCall).toBeTruthy();
    expect(initialRegenCall?.[1]).toMatchObject({
      model: "openai_gpt_image_2_5",
      quality: "ULTRA",
      aspect_ratio: "4:5",
      generate_images: true,
      generate_captions: false,
    });
    expect((initialRegenCall?.[1] as { idempotency_key?: string }).idempotency_key).toBeTruthy();

    // Clicking Regenerate Image must prompt user for what changes they want to make
    fireEvent.click(screen.getByRole("button", { name: /Regenerate Image/i }));
    expect(screen.getByText(/Regenerate Post Image/i)).toBeVisible();

    const changeTextarea = screen.getByLabelText(/What changes would you like to make/i);
    fireEvent.change(changeTextarea, { target: { value: "Add warm sunset lighting and ceramic saucer" } });

    const confirmRegenButtons = screen.getAllByRole("button", { name: /Regenerate Image/i });
    fireEvent.click(confirmRegenButtons[confirmRegenButtons.length - 1]);

    await waitFor(() => {
      const secondRegenCall = postSpy.mock.calls.filter(
        ([url]) => url === "/api/content/content-drafts/draft-1/regenerate/",
      )[1];
      expect(secondRegenCall?.[1]).toMatchObject({
        reason: "Add warm sunset lighting and ceramic saucer",
        generate_images: true,
        generate_captions: false,
        model: "openai_gpt_image_2_5",
        quality: "ULTRA",
        aspect_ratio: "4:5",
      });
    });
  });

  it("disables Generate Content when wallet balance is insufficient", async () => {
    vi.spyOn(apiClient, "post").mockResolvedValue({
      data: {
        model: "google_nano_banana",
        model_label: "Google Nano Banana",
        provider: "google",
        provider_model_id: "gemini-nano-banana-2.1",
        quality: "STANDARD",
        aspect_ratio: "1:1",
        credits: 25,
        image_credits: 5,
        caption_credits: 20,
        caption_count: 4,
        caption_unit_credits: 5,
        base_credits: 5,
        reference_surcharge: 0,
        reference_image_count: 0,
        wallet_balance: 10,
        sufficient_credits: false,
        remaining_after_generation: 0,
        brand_identity_active: false,
        brand_logo_injected: false,
        brand_reference_count: 0,
      },
    } as AxiosResponse);
    vi.spyOn(apiClient, "get").mockResolvedValue({ data: { results: [] } } as AxiosResponse);

    renderWithQuery(<UserContentStudio />);
    fireEvent.change(screen.getByPlaceholderText(/Example: Write a LinkedIn post/i), {
      target: { value: "Coffee banner" },
    });

    await waitFor(() => {
      expect(screen.getByText(/Insufficient AI credits/i)).toBeVisible();
    });
    expect(screen.getByRole("button", { name: /Generate Content/i })).toBeDisabled();
  });
});
