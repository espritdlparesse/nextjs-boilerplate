import { View } from "react-native";
import { PillButton } from "./PillButton";
import { appStyles } from "../styles/appStyles";
import { type ThemeMode } from "../shared/everyyou/domain";
import type { TimelineSpreadPreset } from "../hooks/timelineTypes";

const PRESETS: { preset: TimelineSpreadPreset; short: string; sentence: string }[] = [
  { preset: "this_month", short: "недавно", sentence: "это было недавно" },
  { preset: "last_month", short: "прошлый месяц", sentence: "это было в прошлом месяце" },
  { preset: "last_6_months", short: "полгода", sentence: "это было за последние полгода" },
  { preset: "this_year", short: "этот год", sentence: "это было в этом году" },
  { preset: "very_old", short: "очень давно", sentence: "это было очень давно" },
];

export function TimelinePresetPills({
  themeMode,
  wording = "short",
  disabled = false,
  firstLabel,
  onPress,
  children,
}: {
  themeMode: ThemeMode;
  wording?: "short" | "sentence";
  disabled?: boolean;
  firstLabel?: string;
  onPress: (preset: TimelineSpreadPreset) => void;
  children?: React.ReactNode;
}) {
  return (
    <View style={appStyles.row}>
      {PRESETS.map((entry, index) => (
        <PillButton
          key={entry.preset}
          themeMode={themeMode}
          label={index === 0 && firstLabel ? firstLabel : entry[wording]}
          onPress={() => onPress(entry.preset)}
          disabled={disabled}
        />
      ))}
      {children}
    </View>
  );
}
