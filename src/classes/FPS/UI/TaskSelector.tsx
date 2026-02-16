import React, { useState } from "react";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, LineElement, PointElement, LinearScale, Title, CategoryScale } from "chart.js";
import type { TaskDefinition } from "../Components/Task";

ChartJS.register(LineElement, PointElement, LinearScale, Title, CategoryScale);

type TaskSelectorProps = {
  tasks: TaskDefinition[];
  onSelect: (task: TaskDefinition) => void;
};

export const TaskSelector: React.FC<TaskSelectorProps> = ({ tasks, onSelect }) => {
  const [hoveredTask, setHoveredTask] = useState<TaskDefinition | null>(null);

  const getChartData = () => {
    if (!hoveredTask) return { labels: ["0"], datasets: [{ data: [0] }] };

    const allScores = JSON.parse(localStorage.getItem("taskScores") || "{}");
    const taskScores = allScores[hoveredTask.task_name] || [];

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
        {tasks.map((task) => (
          <div
            key={task.task_name}
            style={{
              padding: "8px 12px",
              backgroundColor: hoveredTask === task ? "#4CAF50" : "#222",
              color: "white",
              cursor: "pointer",
              borderRadius: 4,
              textAlign: "center",
              userSelect: "none",
              height: 20,
            }}
            onMouseEnter={() => setHoveredTask(task)}
            //onMouseLeave={() => setHoveredTask(null)}
            onClick={() => onSelect(task)}
          >
            {task.task_name}
          </div>
        ))}
      </div>

      {/* Right: Hover Preview */}
      {hoveredTask && (
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
          <div style={{ fontWeight: "bold", marginBottom: 8 }}>{hoveredTask.task_name}</div>
          <div style={{ flex: 1 }}>
            <Line
              data={getChartData()}
              options={{
                responsive: false, // fixed size
                plugins: { legend: { display: false } },
                scales: { x: { display: false }, y: { beginAtZero: true } },
              }}
              width={250}
              height={120}
            />
          </div>
        </div>
      )}
    </div>
  );
};
