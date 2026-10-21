import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { ErrorBoundary } from "./ErrorBoundary";

describe("ErrorBoundary", () => {
  it("renders children when no error occurs", () => {
    const html = renderToString(
      <ErrorBoundary>
        <div id="child-ok">content</div>
      </ErrorBoundary>,
    );
    expect(html).toContain("child-ok");
    expect(html).toContain("content");
  });

  it("renders a friendly fallback with a retry button when in error state", () => {
    // Suppress the expected console.error noise from the boundary's componentDidCatch.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Drive the error-state render path directly (mirrors what
    // getDerivedStateFromError produces when a child throws at runtime;
    // renderToString does not invoke error boundaries).
    const boundary = new ErrorBoundary({ children: null });
    boundary.state = { error: new Error("kaboom") };
    const html = renderToString(boundary.render() as React.ReactElement);

    expect(html).toContain("Something went wrong");
    expect(html).toContain("kaboom");
    expect(html).toContain("Try again");

    spy.mockRestore();
  });
});
