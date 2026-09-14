import { beforeEach, describe, expect, it } from "vitest";
import {
  getRefreshTokenStorageMode,
  getStoredRefreshToken,
  storeRefreshToken,
} from "@/services/api-client";

describe("authentication storage mode & rotation persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("stores persistent refresh tokens in localStorage and clears sessionStorage", () => {
    storeRefreshToken("token_persistent", true);
    expect(localStorage.getItem("ma_refresh")).toBe("token_persistent");
    expect(sessionStorage.getItem("ma_refresh")).toBeNull();
    expect(getRefreshTokenStorageMode()).toBe("local");
    expect(getStoredRefreshToken()).toBe("token_persistent");
  });

  it("stores session refresh tokens in sessionStorage and clears localStorage", () => {
    storeRefreshToken("token_session", false);
    expect(sessionStorage.getItem("ma_refresh")).toBe("token_session");
    expect(localStorage.getItem("ma_refresh")).toBeNull();
    expect(getRefreshTokenStorageMode()).toBe("session");
    expect(getStoredRefreshToken()).toBe("token_session");
  });

  it("clears both localStorage and sessionStorage on logout / clear", () => {
    localStorage.setItem("ma_refresh", "old_local");
    sessionStorage.setItem("ma_refresh", "old_session");
    storeRefreshToken(null);
    expect(localStorage.getItem("ma_refresh")).toBeNull();
    expect(sessionStorage.getItem("ma_refresh")).toBeNull();
    expect(getRefreshTokenStorageMode()).toBeNull();
    expect(getStoredRefreshToken()).toBeNull();
  });

  it("preserves persistent storage scope during token rotation simulation", () => {
    // 1. Initial persistent login (Remember me checked)
    storeRefreshToken("initial_token", true);
    expect(getRefreshTokenStorageMode()).toBe("local");

    // 2. Token rotation occurs: mode is detected before storing rotated token
    const modeBeforeRotation = getRefreshTokenStorageMode();
    const rotatedToken = "rotated_token_123";
    storeRefreshToken(rotatedToken, modeBeforeRotation === "local");

    // 3. Rotated token remains in localStorage
    expect(localStorage.getItem("ma_refresh")).toBe("rotated_token_123");
    expect(sessionStorage.getItem("ma_refresh")).toBeNull();
    expect(getRefreshTokenStorageMode()).toBe("local");
  });

  it("preserves session storage scope during token rotation simulation", () => {
    // 1. Initial non-persistent login (Remember me unchecked)
    storeRefreshToken("session_token", false);
    expect(getRefreshTokenStorageMode()).toBe("session");

    // 2. Token rotation occurs: mode is detected before storing rotated token
    const modeBeforeRotation = getRefreshTokenStorageMode();
    const rotatedToken = "rotated_session_456";
    storeRefreshToken(rotatedToken, modeBeforeRotation === "local");

    // 3. Rotated token remains in sessionStorage
    expect(sessionStorage.getItem("ma_refresh")).toBe("rotated_session_456");
    expect(localStorage.getItem("ma_refresh")).toBeNull();
    expect(getRefreshTokenStorageMode()).toBe("session");
  });
});
