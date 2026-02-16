import React, { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, LineElement, PointElement, LinearScale, Title, CategoryScale } from "chart.js";
import type { TaskDefinition } from "../Components/Task";

ChartJS.register(LineElement, PointElement, LinearScale, Title, CategoryScale);


type TaskButtonProps = {
  task: TaskDefinition;
  isHovered: boolean;
  onHover: (task: TaskDefinition | null) => void;
  onClick: (task: TaskDefinition) => void;
};

export const TaskButton: React.FC<TaskButtonProps> = ({ task, isHovered, onHover, onClick }) => {
  return (
    <div
      style={{
        padding: "8px 12px",
        backgroundColor: isHovered ? "#4CAF50" : "#222",
        color: "white",
        cursor: "pointer",
        borderRadius: 4,
        textAlign: "center",
        userSelect: "none",
        height: 20,
        width: "auto",
      }}
      onMouseEnter={() => onHover(task)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(task)}
    >
      {task.task_name}
    </div>
  );
};



type TaskInfoCardProps = {
  task: TaskDefinition;
};

export const TaskInfoCard: React.FC<TaskInfoCardProps> = ({ task }) => {
  const getChartData = () => {
    const allScores = JSON.parse(localStorage.getItem("taskScores") || "{}");
    const taskScores = allScores[task.task_name] || [];

    const labels = taskScores.length ? taskScores.map((_, i) => `#${i + 1}`) : ["0"];
    const data = taskScores.length ? taskScores.map((s: any) => (s.score > 0 ? 1 / s.score : 0)) : [0];

    return {
      labels,
      datasets: [
        {
          label: "Performance (1/time)",
          data,
          fill: false,
          borderColor: "rgba(75,192,192,1)",
          tension: 0.2,
          pointRadius: 3,
        },
      ],
    };
  };

  return (
    <div
      style={{
        width: 250,
        height: 140,
        backgroundColor: "rgba(0,0,0,0.75)",
        padding: 12,
        borderRadius: 6,
        color: "white",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: 8 }}>{task.task_name}</div>
      <div style={{ flex: 1 }}>
        <Line
          data={getChartData()}
          options={{
            responsive: false,
            plugins: { legend: { display: false } },
            scales: { x: { display: false }, y: { beginAtZero: true } },
          }}
          width={250}
          height={120}
        />
      </div>
    </div>
  );
};

type TaskSelectorProps = {
  tasks: TaskDefinition[];
  onSelect: (task: TaskDefinition) => void;
};

export const TaskSelector: React.FC<TaskSelectorProps> = ({ tasks, onSelect }) => {
  const [hoveredTask, setHoveredTask] = useState<TaskDefinition | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0); // first task selected

  const selectedTask = tasks[selectedIndex] || null;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "arrowup" || key === "w") {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : tasks.length - 1));
      } else if (key === "arrowdown" || key === "s") {
        setSelectedIndex((prev) => (prev < tasks.length - 1 ? prev + 1 : 0));
      } else if ((key === "enter" || key === " ") && selectedTask) {
        onSelect(selectedTask);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tasks, selectedTask, onSelect]);

  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        left: 20,
        display: "flex",
        flexDirection: "row",
        gap: 16,
        zIndex: 1000,
      }}
    >
      {/* Left: Task Buttons */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          width: 200,
        }}
      >
        {tasks.map((task, idx) => (
          <TaskButton
            key={task.task_name}
            task={task}
            isHovered={hoveredTask === task || selectedIndex === idx} // highlight hover or selected
            onHover={setHoveredTask}
            onClick={() => {
              onSelect(task);
              setSelectedIndex(idx); // update selection on click
            }}
          />
        ))}
      </div>

      {/* Right: Hover/Selected Preview */}
      {(hoveredTask || selectedTask) && (
        <TaskInfoCard task={hoveredTask || selectedTask} />
      )}
    </div>
  );
};

