import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type WeeklyRow = { day: string; minutes: number; hours: number };
export type SubjectRow = { subject: string; level: number };

export default function StatsCharts(props: {
  weekly: WeeklyRow[];
  subjects: SubjectRow[];
}) {
  const { weekly, subjects } = props;

  return (
    <>
      <div className="h-72 overflow-x-auto">
        <div className="min-w-[520px] h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weekly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(17,24,39,0.85)",
                  color: "white",
                }}
                formatter={(v: unknown) => [`${v} ساعة`, "النشاط"]}
              />
              <Area
                type="monotone"
                dataKey="hours"
                stroke="var(--primary)"
                fill="var(--primary)"
                fillOpacity={0.18}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="h-72 overflow-x-auto">
        <div className="min-w-[520px] h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={subjects} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
              <XAxis dataKey="subject" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(17,24,39,0.85)",
                  color: "white",
                }}
                formatter={(v: unknown) => [`${v}%`, "المستوى"]}
              />
              <Bar dataKey="level" radius={[10, 10, 0, 0]} fill="var(--primary)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
