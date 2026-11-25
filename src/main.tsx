import React from "react";
import ReactDOM from "react-dom/client";
import { Studio } from "./presentation/studio";
import "./presentation/studio.css";

// Native drag-drop is disabled so the composer can receive HTML drops. Stop
// files dropped anywhere else from navigating the webview away from the app.
const blockStrayFileDrop = (event: DragEvent) => {
  if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
};
window.addEventListener("dragover", blockStrayFileDrop);
window.addEventListener("drop", blockStrayFileDrop);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Studio />
  </React.StrictMode>,
);
