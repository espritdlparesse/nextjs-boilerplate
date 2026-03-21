import { Pressable, Text, type StyleProp, type ViewStyle } from "react-native";
import { appStyles } from "../styles/appStyles";

type PillVariant = "primary" | "secondary" | "danger";

type PillButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
  variant?: PillVariant;
  style?: StyleProp<ViewStyle>;
};

export function PillButton({
  label,
  onPress,
  disabled = false,
  active = false,
  variant = "secondary",
  style,
}: PillButtonProps) {
  return (
    <Pressable
      style={[
        appStyles.pillButton,
        variant === "primary" && appStyles.primaryButton,
        variant === "secondary" && appStyles.secondaryButton,
        variant === "danger" && appStyles.dangerButton,
        active && appStyles.activeTabButton,
        disabled && appStyles.disabledButton,
        style,
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text
        style={
          variant === "primary" || active ? appStyles.primaryText : appStyles.secondaryText
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}
