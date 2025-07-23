import type React from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Route, Routes } from "react-router-dom";
import { SyncProvider } from "./components/SyncProvider";
import Pinboard from "./views/Pinboard";

const App: React.FC = () => {
  return (
    <SyncProvider>
      <DndProvider backend={HTML5Backend}>
        <Routes>
          <Route path="/" element={<Pinboard />} />
        </Routes>
      </DndProvider>
    </SyncProvider>
  );
};

export default App;
