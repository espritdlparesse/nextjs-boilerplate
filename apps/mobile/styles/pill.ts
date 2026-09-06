import { StyleSheet } from "react-native";

import { colors } from "./colors";

export const pillStyles = StyleSheet.create({
  secondaryButton: {
    backgroundColor: colors.white,
    borderColor: colors.line,
  },
  dangerButton: {
    backgroundColor: "#FFF3F7",
    borderColor: "#FFD4E6",
  },
  activeTabButton: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
});
