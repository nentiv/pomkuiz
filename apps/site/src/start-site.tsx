import { render } from "preact";
import "@pomkuiz/design-system/load-design-system";
import { App } from "./app/App.tsx";

const root = document.getElementById("app");
if (root) render(<App />, root);
