import * as React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

export default function QuestionPieChart(props: {
  pieData: Array<{ name: string; value: number }>;
  colors: string[];
}) {
  const { pieData, colors } = props;

  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={3}
          >
            {pieData.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
