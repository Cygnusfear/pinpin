import type React from "react";
import { Route, Routes } from "react-router-dom";
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Pinboard from "./views/Pinboard";

const App: React.FC = () => {
  return (
    <DndProvider backend={HTML5Backend}>
      <Routes>
        <Route path="/" element={<Pinboard />} />
      </Routes>
    </DndProvider>
  );
};

export default App;
