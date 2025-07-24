import type React from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Route, Routes } from "react-router-dom";
import { SyncProvider } from "./components/SyncProvider";
import { TooltipProvider } from "./components/ui/tooltip";
import Pinboard from "./views/Pinboard";
import "./index.css";

const App: React.FC = () => {
  return (
    <SyncProvider>
      <TooltipProvider>
        <DndProvider backend={HTML5Backend}>
          <Routes>
            <Route path="/" element={<Pinboard />} />
          </Routes>
        </DndProvider>
      </TooltipProvider>
    </SyncProvider>
  );
};

export default App;
