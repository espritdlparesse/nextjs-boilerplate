import { useEffect } from "react";
import { Text } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { appStyles } from "../styles/appStyles";
import type { getTheme } from "../styles/theme";

const SPRING = { damping: 14, stiffness: 180, mass: 0.8 };
const FADE_OUT = { duration: 170, easing: Easing.out(Easing.quad) };
const FADE_IN = { duration: 210, easing: Easing.out(Easing.quad) };

export function Toast({ message, theme }: { message: string | null; theme: ReturnType<typeof getTheme> }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(18);
  const scale = useSharedValue(0.96);

  useEffect(() => {
    if (!message) {
      opacity.value = withTiming(0, FADE_OUT);
      translateY.value = withTiming(18, FADE_OUT);
      scale.value = withTiming(0.96, FADE_OUT);
      return;
    }

    translateY.value = withSpring(0, SPRING);
    scale.value = withSpring(1, SPRING);
    opacity.value = withTiming(1, FADE_IN);
  }, [message, opacity, scale, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  if (!message) return null;
  return (
    <Animated.View style={[appStyles.toast, animatedStyle, { backgroundColor: theme.toastBg }]}>
      <Text style={[appStyles.toastText, { color: theme.toastText }]}>{message}</Text>
    </Animated.View>
  );
}
