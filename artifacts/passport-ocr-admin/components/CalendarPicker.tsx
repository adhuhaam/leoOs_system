import { Feather } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DOW = ["Su","Mo","Tu","We","Th","Fr","Sa"];

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface Props {
  value: string;
  onChange: (date: string) => void;
  allowPast?: boolean;
}

export function CalendarPicker({ value, onChange, allowPast = true }: Props) {
  const colors = useColors();
  const todayStr = todayISO();
  const sel = value ? new Date(value + "T12:00:00") : null;
  const [viewYear, setViewYear] = useState(sel?.getFullYear() ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(sel?.getMonth() ?? new Date().getMonth());

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function toStr(day: number) {
    return `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return (
    <View style={[styles.calWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.calHeader}>
        <Pressable onPress={prevMonth} hitSlop={14} style={styles.calNavBtn}>
          <Feather name="chevron-left" size={18} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.calMonthLabel, { color: colors.foreground }]}>
          {MONTHS[viewMonth]} {viewYear}
        </Text>
        <Pressable onPress={nextMonth} hitSlop={14} style={styles.calNavBtn}>
          <Feather name="chevron-right" size={18} color={colors.foreground} />
        </Pressable>
      </View>

      <View style={styles.calDowRow}>
        {DOW.map((d) => (
          <Text key={d} style={[styles.calDow, { color: colors.mutedForeground }]}>{d}</Text>
        ))}
      </View>

      <View style={styles.calGrid}>
        {cells.map((day, i) => {
          if (!day) return <View key={i} style={styles.calCell} />;
          const ds = toStr(day);
          const isToday = ds === todayStr;
          const isSelected = ds === value;
          const isPast = !allowPast && ds < todayStr;
          return (
            <Pressable
              key={i}
              disabled={isPast}
              style={[
                styles.calCell,
                isSelected && { backgroundColor: colors.primary, borderRadius: 20 },
                !isSelected && isToday && { borderWidth: 1.5, borderColor: colors.primary, borderRadius: 20 },
              ]}
              onPress={() => onChange(ds === value ? "" : ds)}
            >
              <Text
                style={[
                  styles.calDayText,
                  {
                    color: isSelected
                      ? "#fff"
                      : isToday
                      ? colors.primary
                      : colors.foreground,
                    opacity: isPast && !isSelected ? 0.35 : 1,
                  },
                ]}
              >
                {day}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {value ? (
        <Pressable onPress={() => onChange("")} style={styles.calClear}>
          <Text style={[styles.calClearText, { color: colors.mutedForeground }]}>Clear date</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  calWrap: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 8,
    marginTop: 4,
  },
  calHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  calNavBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  calMonthLabel: { fontSize: 15, fontWeight: "600" },
  calDowRow: { flexDirection: "row" },
  calDow: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600", paddingVertical: 4 },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calCell: { width: "14.28%" as any, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  calDayText: { fontSize: 13, fontWeight: "500" },
  calClear: { alignItems: "center", paddingVertical: 6 },
  calClearText: { fontSize: 12 },
});
