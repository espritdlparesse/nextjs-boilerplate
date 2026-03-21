import { Pressable, Text, type StyleProp, type ViewStyle } from "react-native";
import { type ThemeMode } from "../shared/everyyou/domain";
import { appStyles } from "../styles/appStyles";
import { getTheme } from "../styles/theme";

type PillVariant = "primary" | "secondary" | "danger";

type PillButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
  variant?: PillVariant;
  style?: StyleProp<ViewStyle>;
  themeMode?: ThemeMode;
};

export function PillButton({
  label,
  onPress,
  disabled = false,
  active = false,
  variant = "secondary",
  style,
  themeMode = "light",
}: PillButtonProps) {
  const theme = getTheme(themeMode);
  const buttonVariantStyle =
    variant === "primary"
      ? { backgroundColor: theme.buttonPrimaryBg, borderColor: theme.buttonPrimaryBorder }
      : variant === "danger"
        ? { backgroundColor: theme.buttonDangerBg, borderColor: theme.buttonDangerBorder }
        : { backgroundColor: theme.buttonSecondaryBg, borderColor: theme.buttonSecondaryBorder };
  const activeStyle = active
    ? { backgroundColor: theme.buttonPrimaryBg, borderColor: theme.buttonPrimaryBorder }
    : null;
  const textStyle =
    variant === "primary" || active
      ? { color: theme.buttonPrimaryText }
      : variant === "danger"
        ? { color: theme.buttonDangerText }
        : { color: theme.buttonSecondaryText };

  return (
    <Pressable
      style={[
        appStyles.pillButton,
        variant === "primary" && appStyles.primaryButton,
        variant === "secondary" && appStyles.secondaryButton,
        variant === "danger" && appStyles.dangerButton,
        active && appStyles.activeTabButton,
        disabled && appStyles.disabledButton,
        buttonVariantStyle,
        activeStyle,
        style,
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={[variant === "primary" || active ? appStyles.primaryText : appStyles.secondaryText, textStyle]}>
        {label}
      </Text>
    </Pressable>
  );
}
