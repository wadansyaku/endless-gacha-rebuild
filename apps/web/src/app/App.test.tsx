import { render, screen } from "@testing-library/react";
import { App } from "./App";

describe("App", () => {
  it("renders the main shell", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Frontline" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /Frontline/ })).toBeInTheDocument();
  });
});
