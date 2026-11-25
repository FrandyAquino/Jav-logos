import React from "react";
import ReactDOM from "react-dom/client";
import { Studio } from "./presentation/studio";
import "./presentation/studio.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Studio />
  </React.StrictMode>,
);
