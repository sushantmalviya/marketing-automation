import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { EmailPhonePreview } from "@/components/user/templates/email-builder/email-phone-preview";

describe("EmailPhonePreview Component", () => {
  it("should render subject, sender, and recipient in mobile mail header", () => {
    const { container } = render(
      <EmailPhonePreview
        subject="Flash 50% Off Everything!"
        html="<p>Check out our big sale today!</p>"
        senderName="StyleStore Marketing"
        recipientEmail="subscriber@example.com"
      />
    );

    expect(screen.getByText("Flash 50% Off Everything!")).toBeDefined();
    expect(screen.getByText("StyleStore Marketing")).toBeDefined();
    expect(screen.getByText("To: subscriber@example.com")).toBeDefined();

    // Verify iframe with rendered HTML content exists
    const iframe = container.querySelector("iframe");
    expect(iframe).toBeDefined();
    expect(iframe?.getAttribute("srcDoc")).toContain("Check out our big sale today!");
  });

  it("should fall back gracefully when subject and html are empty", () => {
    const { container } = render(
      <EmailPhonePreview
        subject=""
        html=""
      />
    );

    expect(screen.getByText("(No Subject)")).toBeDefined();
    const iframe = container.querySelector("iframe");
    expect(iframe?.getAttribute("srcDoc")).toContain("No email content available.");
  });

  it("should inject viewport meta and responsive CSS into iframe srcDoc", () => {
    const { container } = render(
      <EmailPhonePreview
        subject="Welcome"
        html="<div><h1>Welcome to our club</h1></div>"
      />
    );

    const iframe = container.querySelector("iframe");
    const srcDoc = iframe?.getAttribute("srcDoc") || "";

    expect(srcDoc).toContain('<meta name="viewport"');
    expect(srcDoc).toContain("max-width: 100% !important;");
    expect(srcDoc).toContain("Welcome to our club");
    expect(srcDoc).toContain('<base target="_blank">');
    expect(srcDoc).toContain("EMAIL_PREVIEW_LINK_CLICK");
  });

  it("should handle link clicks and open valid HTTP destinations in new tab", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(
      <EmailPhonePreview
        subject="Deals"
        html='<p><a href="https://example.com/deals">Shop Now</a></p>'
      />
    );

    // Simulate link click event posted from iframe
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "EMAIL_PREVIEW_LINK_CLICK",
          url: "https://example.com/deals",
          label: "Shop Now",
        },
      })
    );

    expect(openSpy).toHaveBeenCalledWith("https://example.com/deals", "_blank", "noopener,noreferrer");
    openSpy.mockRestore();
  });

  it("should handle mailto links safely", () => {
    render(
      <EmailPhonePreview
        subject="Contact"
        html='<p><a href="mailto:support@example.com">Contact Support</a></p>'
      />
    );

    // Simulate mailto event
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "EMAIL_PREVIEW_LINK_CLICK",
          url: "mailto:support@example.com",
          label: "Contact Support",
        },
      })
    );
  });
});
