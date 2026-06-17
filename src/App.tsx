import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import TaskList from "@/pages/TaskList";
import ImageCompare from "@/pages/ImageCompare";
import DiffConfirm from "@/pages/DiffConfirm";
import BatchProcess from "@/pages/BatchProcess";
import Preferences from "@/pages/Preferences";

export default function App() {
  return (
    <div className="min-h-screen bg-medical-950 text-zinc-100 font-sans overflow-hidden">
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/tasks" replace />} />
          <Route element={<AppLayout />}>
            <Route path="/tasks" element={<TaskList />} />
            <Route path="/compare" element={<ImageCompare />} />
            <Route path="/confirm" element={<DiffConfirm />} />
            <Route path="/batch" element={<BatchProcess />} />
            <Route path="/preferences" element={<Preferences />} />
          </Route>
        </Routes>
      </Router>
    </div>
  );
}
