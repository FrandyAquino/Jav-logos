// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { RangeField } from "./property-fields";
it("commits a range gesture once instead of queuing a save for every input event", () => {
  const commit = vi.fn(async () => {});
  render(
    <RangeField
      label="Scale"
      value={1}
      min={0.3}
      max={2}
      step={0.05}
      onCommit={commit}
    />,
  );
  const slider = screen.getByRole("slider", { name: "Scale" });
  fireEvent.focus(slider);
  for (const value of ["1.1", "1.2", "1.3", "1.4"])
    fireEvent.change(slider, { target: { value } });
  expect(commit).not.toHaveBeenCalled();
  fireEvent.pointerUp(slider);
  expect(commit).toHaveBeenCalledExactlyOnceWith(1.4);
});
